// backend/src/services/voiceService.js
/**
 * Voice Service - Enhanced Real-time Voice Agent
 * Features:
 * - OpenAI Realtime API integration for conversational AI
 * - Call session tracking with transcription
 * - Function calling for bookings and actions
 * - Post-call summarization and meeting notes
 */

const twilioService = require('./twilioService');
const prisma = require('../lib/prisma');
const WebSocket = require('ws');
const agentToolsService = require('./agentToolsService');
const summarizeService = require('./summarizeService');
const chatService = require('./chatService');
const logger = require('../lib/logger')('VoiceService');

// In-memory storage for call logs (legacy support)
const callLogs = [];

// Active call sessions
const activeSessions = new Map();

/**
 * Get call logs for a tenant
 */
function getCallLogs(tenantId = null) {
    if (tenantId) {
        return callLogs.filter(log => log.tenantId === tenantId);
    }
    return callLogs;
}

/**
 * Get Call Status
 */
async function getCallStatus(callId, tenantId = null) {
    const log = callLogs.find(log => {
        if (tenantId) {
            return log.callId === callId && log.tenantId === tenantId;
        }
        return log.callId === callId;
    });

    if (log) {
        return {
            callId: log.callId,
            status: log.status,
            phoneNumber: log.phoneNumber,
            duration: log.duration,
            timestamp: log.timestamp,
            tenantId: log.tenantId,
            source: 'local_log'
        };
    }
    try {
        const status = await twilioService.getCallStatus(tenantId, callId);
        return { ...status, source: 'twilio_api' };
    } catch (e) {
        return null;
    }
}

/**
 * Get call sessions for a tenant (from database)
 */
async function getCallSessions(tenantId, options = {}) {
    const { limit = 50, includeTranscript = false } = options;

    const sessions = await prisma.callSession.findMany({
        where: { tenantId },
        orderBy: { startedAt: 'desc' },
        take: limit,
        include: {
            client: true
        },
        select: {
            id: true,
            callSid: true,
            callerPhone: true,
            status: true,
            direction: true,
            startedAt: true,
            endedAt: true,
            duration: true,
            summary: true,
            actionItems: true,
            bookingId: true,
            client: { select: { id: true, name: true, phone: true } },
            ...(includeTranscript && { transcript: true })
        }
    });

    return sessions;
}

/**
 * Get a single call session with full details
 */
async function getCallSession(callSessionId, tenantId) {
    const session = await prisma.callSession.findFirst({
        where: { id: callSessionId, tenantId },
        include: {
            client: true,
            messages: {
                orderBy: { createdAt: 'asc' }
            }
        }
    });

    return session;
}

// Configuration
const voiceConfig = require('../config/voice');

/**
 * SmartWebSocket - Robust WebSocket wrapper with auto-reconnection
 */
class SmartWebSocket extends WebSocket {
    constructor(url, options = {}, retryConfig = {}) {
        super(url, options);
        this._url = url;
        this._options = options;
        this._retryConfig = {
            maxRetries: retryConfig.maxRetries || 5,
            initialDelay: retryConfig.initialDelay || 1000,
            factor: 2,
            ...retryConfig
        };
        this._retryCount = 0;
        this._isReconnecting = false;
        this._intentionalClose = false;
        this._messageQueue = [];

        this.init();
    }

    init() {
        this.addEventListener('close', this.handleClose.bind(this));
        this.addEventListener('error', this.handleError.bind(this));
        this.addEventListener('open', () => {
            logger.info('Connected to OpenAI');
            this._retryCount = 0;
            this._isReconnecting = false;
            this.flushQueue();
        });
    }

    handleClose(event) {
        if (this._intentionalClose) return;

        logger.warn(`Connection closed (Code: ${event.code}). Retry ${this._retryCount}/${this._retryConfig.maxRetries}`);

        if (this._retryCount < this._retryConfig.maxRetries) {
            this._isReconnecting = true;
            const delay = this._retryConfig.initialDelay * Math.pow(this._retryConfig.factor, this._retryCount);
            this._retryCount++;

            setTimeout(() => {
                logger.info(`Reconnecting... (${delay}ms)`);
                this.reconnect();
            }, delay);
        } else {
            logger.error('Max retries exhausted. Connection failed.');
            this.emit('max_retries_exceeded');
        }
    }

    handleError(error) {
        if (!this._isReconnecting) {
            logger.error('WebSocket Error', error);
        }
    }

    reconnect() {
        if (this._options.onReconnect) {
            this._options.onReconnect();
        }
    }

    send(data) {
        if (this.readyState === WebSocket.OPEN) {
            super.send(data);
        } else {
            logger.warn('Buffering message (Socket not open)');
            this._messageQueue.push(data);
        }
    }

    flushQueue() {
        while (this._messageQueue.length > 0 && this.readyState === WebSocket.OPEN) {
            super.send(this._messageQueue.shift());
        }
    }

    close() {
        this._intentionalClose = true;
        super.close();
    }
}

/**
 * Handle WebSocket Connection for Twilio Media Stream + OpenAI Realtime
 */
function handleConnection(ws, req) {
    logger.info('New Media Stream Connection');

    let streamSid = null;
    let openAiWs = null;
    let callSessionId = null;
    let tenantId = null;
    let callerPhone = null;
    let startTime = Date.now();
    let currentInstructions = voiceConfig.system.defaultInstructions;

    // Transcript collection
    const transcriptParts = [];

    // Connect to OpenAI Realtime API
    const connectOpenAI = () => {
        try {
            const url = `${voiceConfig.openai.url}?model=${voiceConfig.openai.model}`;
            openAiWs = new WebSocket(url, {
                headers: {
                    "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
                    "OpenAI-Beta": "realtime=v1",
                },
            });

            setupOpenAIHandlers();
        } catch (error) {
            logger.error("Failed to connect to OpenAI", error);
            ws.close();
        }
    };

    const setupOpenAIHandlers = () => {
        openAiWs.on('open', () => {
            logger.info('Connected to OpenAI Realtime API');

            // Send initial session configuration
            const sessionUpdate = {
                type: 'session.update',
                session: {
                    turn_detection: { type: 'server_vad' }, // Enable Voice Activity Detection
                    input_audio_format: voiceConfig.twilio.mediaFormat,
                    output_audio_format: voiceConfig.twilio.mediaFormat,
                    voice: voiceConfig.openai.voice,
                    instructions: currentInstructions,
                    modalities: ["text", "audio"],
                    temperature: voiceConfig.openai.temperature,
                    tools: agentToolsService.getToolsForSession(),
                    tool_choice: 'auto'
                }
            };
            openAiWs.send(JSON.stringify(sessionUpdate));
        });

        openAiWs.on('message', async (data) => {
            try {
                const response = JSON.parse(data);

                switch (response.type) {
                    case 'input_audio_buffer.speech_started':
                        // BARGE-IN DETECTED: User started speaking
                        logger.info('Barge-in Detected via VAD', { streamSid });

                        // 1. Clear Twilio Audio Buffer immediately
                        if (streamSid && ws.readyState === WebSocket.OPEN) {
                            const clearMsg = {
                                event: 'clear',
                                streamSid: streamSid
                            };
                            ws.send(JSON.stringify(clearMsg));
                        }

                        // 2. Cancel OpenAI Generation
                        if (openAiWs.readyState === WebSocket.OPEN) {
                            openAiWs.send(JSON.stringify({ type: 'response.cancel' }));
                        }
                        break;

                    case 'response.audio.delta':
                        // Stream audio back to Twilio
                        if (response.delta && streamSid && ws.readyState === WebSocket.OPEN) {
                            const audioDelta = {
                                event: 'media',
                                streamSid: streamSid,
                                media: { payload: response.delta }
                            };
                            ws.send(JSON.stringify(audioDelta));
                        }
                        break;

                    case 'response.audio_transcript.done':
                        // Capture AI's spoken response
                        if (response.transcript) {
                            transcriptParts.push({ role: 'assistant', content: response.transcript, timestamp: Date.now() });
                            if (callSessionId && tenantId) {
                                await saveTranscriptMessage(tenantId, callSessionId, 'assistant', response.transcript);
                            }
                        }
                        break;

                    case 'conversation.item.input_audio_transcription.completed':
                        // Capture User's spoken input
                        if (response.transcript) {
                            transcriptParts.push({ role: 'user', content: response.transcript, timestamp: Date.now() });
                            if (callSessionId && tenantId) {
                                await saveTranscriptMessage(tenantId, callSessionId, 'user', response.transcript);
                            }
                        }
                        break;

                    case 'response.function_call_arguments.done':
                        logger.info('Function call invoked', { function: response.name, callSessionId });
                        const toolResult = await agentToolsService.executeTool(
                            response.name,
                            JSON.parse(response.arguments || '{}'),
                            { tenantId, callerPhone, callSessionId }
                        );

                        if (openAiWs.readyState === WebSocket.OPEN) {
                            openAiWs.send(JSON.stringify({
                                type: 'conversation.item.create',
                                item: {
                                    type: 'function_call_output',
                                    call_id: response.call_id,
                                    output: JSON.stringify(toolResult)
                                }
                            }));
                            openAiWs.send(JSON.stringify({ type: 'response.create' }));
                        }
                        break;

                    case 'error':
                        logger.error('OpenAI Error Event', null, { error: response.error });
                        break;
                }
            } catch (e) {
                logger.error('Error processing OpenAI message', e);
            }
        });

        openAiWs.on('close', () => logger.info('OpenAI WebSocket closed'));
        openAiWs.on('error', (err) => logger.error('OpenAI WebSocket error', err));
    };

    // Initial connection
    connectOpenAI();

    // Twilio Handlers (Client -> Server)
    ws.on('message', async (message) => {
        try {
            const msg = JSON.parse(message);

            switch (msg.event) {
                case 'start':
                    streamSid = msg.start.streamSid;
                    logger.info('Twilio Stream started', { streamSid });

                    // Initial Parameters
                    const params = msg.start.customParameters || {};
                    tenantId = params.tenantId;
                    callerPhone = params.From || msg.start.from;
                    const callSid = params.CallSid || msg.start.callSid;

                    // Session Creation logic matches previous implementation
                    if (tenantId && callSid) {
                        // ... (Reuse existing logic for fast implementation)
                        setupCallSession(tenantId, callSid, callerPhone).then((id) => {
                            callSessionId = id;
                            activeSessions.set(streamSid, { callSessionId, tenantId });
                        });

                        // Retrieve and set customized System Prompt
                        updateSystemPrompt(tenantId, callerPhone, openAiWs).then(prompt => {
                            currentInstructions = prompt;
                        });
                    }
                    break;

                case 'media':
                    if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
                        openAiWs.send(JSON.stringify({
                            type: 'input_audio_buffer.append',
                            audio: msg.media.payload
                        }));
                    }
                    break;

                case 'stop':
                    logger.info('Twilio Stream stopped', { streamSid: msg.stop?.streamSid || streamSid });
                    cleanupSession();
                    break;
            }
        } catch (e) {
            logger.error('Error parsing Twilio message', e);
        }
    });

    const cleanupSession = async () => {
        if (callSessionId) {
            await completeCallSession(callSessionId, transcriptParts, startTime);
        }
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
            openAiWs.close();
        }
        if (streamSid) activeSessions.delete(streamSid);
    };

    ws.on('close', async () => {
        logger.info('Client disconnected');
        cleanupSession();
    });

    // Helper to keep code clean - duplicates original logic wrapped in functions
    async function setupCallSession(tId, cSid, cPhone) {
        try {
            let clientId = null;
            if (cPhone) {
                const client = await prisma.client.findFirst({
                    where: { tenantId: tId, phone: { contains: cPhone.slice(-10) } }
                });
                if (client) clientId = client.id;
            }

            const session = await prisma.callSession.create({
                data: {
                    tenantId: tId,
                    clientId,
                    callSid: cSid,
                    callerPhone: cPhone,
                    status: 'in_progress',
                    direction: 'inbound',
                    startedAt: new Date()
                }
            });
            logger.info('Call session created', { callSessionId: session.id, callSid: cSid });
            return session.id;
        } catch (e) {
            logger.error('Error creating call session', e);
            return null;
        }
    }

    async function updateSystemPrompt(tId, cPhone, wsTarget) {
        try {
            const tenant = await prisma.tenant.findUnique({
                where: { id: tId },
                select: { aiConfig: true, name: true }
            });

            if (tenant) {
                const aiConfig = tenant.aiConfig || {};
                let instructions = aiConfig.systemPrompt || voiceConfig.system.defaultInstructions;

                if (cPhone) {
                    const client = await prisma.client.findFirst({
                        where: { tenantId: tId, phone: { contains: cPhone.slice(-10) } },
                        select: { name: true }
                    });
                    if (client) instructions += `\n\nThe caller is ${client.name}.`;
                }

                if (aiConfig.faqs?.length > 0) {
                    instructions += `\n\nKnowledge Base:\n${aiConfig.faqs.map(f => `- ${f.question}: ${f.answer}`).join('\n')}`;
                }

                if (wsTarget && wsTarget.readyState === WebSocket.OPEN) {
                    wsTarget.send(JSON.stringify({
                        type: 'session.update',
                        session: { instructions, voice: aiConfig.voiceId || voiceConfig.openai.voice }
                    }));
                }
                return instructions;
            }
        } catch (e) {
            logger.error('Error updating prompt', e);
        }
        return voiceConfig.system.defaultInstructions;
    }
}

/**
 * Save a transcript message to the database
 */
async function saveTranscriptMessage(tenantId, callSessionId, role, content) {
    try {
        await prisma.message.create({
            data: {
                tenantId,
                callSessionId,
                sessionId: `call_${callSessionId}`,
                role,
                content,
                source: 'voice'
            }
        });
    } catch (e) {
        logger.error('Error saving transcript message', e);
    }
}

/**
 * Complete a call session - update status, calculate duration, generate summary
 */
async function completeCallSession(callSessionId, transcriptParts, startTime) {
    try {
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);

        // Build full transcript
        const transcript = transcriptParts.length > 0
            ? transcriptParts.map(p => `${p.role === 'user' ? 'Caller' : 'AI'}: ${p.content}`).join('\n\n')
            : null;

        // Update session with completion data
        await prisma.callSession.update({
            where: { id: callSessionId },
            data: {
                status: 'completed',
                endedAt: new Date(),
                duration,
                transcript
            }
        });

        logger.info('Call session completed', { callSessionId, duration });

        // Generate summary asynchronously (don't block)
        if (transcript && transcript.length > 50) {
            setImmediate(async () => {
                try {
                    await summarizeService.processCompletedCall(callSessionId, {
                        createMeetingMinute: false // Set to true to auto-create meeting minutes
                    });
                } catch (e) {
                    logger.error('Error generating post-call summary', e);
                }
            });
        }
    } catch (e) {
        logger.error('Error completing call session', e);
    }
}

/**
 * Regenerate summary for a call session
 */
async function regenerateSummary(callSessionId, tenantId) {
    const session = await prisma.callSession.findFirst({
        where: { id: callSessionId, tenantId }
    });

    if (!session) {
        throw new Error('Call session not found');
    }

    if (!session.transcript) {
        throw new Error('No transcript available for this call');
    }

    const result = await summarizeService.processCompletedCall(callSessionId);
    return result;
}

/**
 * Initiate outbound call via Twilio
 * Creates a call that connects to the AI voice agent via media stream
 */
async function initiateOutboundCall(phoneNumber, tenantId, customData = {}) {
    try {
        const twilioService = require('./twilioService');

        // Get Twilio client for tenant
        const { client, phoneNumber: fromNumber, accountSid } = await twilioService.getClientForTenant(tenantId);

        if (!fromNumber) {
            return {
                success: false,
                error: 'no_phone_number',
                message: 'No Twilio phone number configured for this organization'
            };
        }

        // Build webhook URL that will connect to media stream
        const appUrl = process.env.APP_URL || 'http://localhost:5000';
        const webhookUrl = `${appUrl}/api/twilio/webhook/voice/outbound-stream?tenantId=${tenantId}`;
        const statusUrl = `${appUrl}/api/twilio/webhook/status`;

        logger.info('Initiating outbound call', { phoneNumber, fromNumber });

        // Create the call
        const call = await client.calls.create({
            to: phoneNumber,
            from: fromNumber,
            url: webhookUrl,
            method: 'POST',
            statusCallback: statusUrl,
            statusCallbackMethod: 'POST',
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
        });

        logger.info('Outbound call created', { callSid: call.sid });

        // Create call session record
        const session = await prisma.callSession.create({
            data: {
                tenantId,
                callSid: call.sid,
                callerPhone: phoneNumber,
                status: 'in_progress',
                direction: 'outbound',
                startedAt: new Date()
            }
        });

        return {
            success: true,
            callId: call.sid,
            sessionId: session.id,
            status: call.status,
            message: 'Call initiated successfully'
        };
    } catch (error) {
        logger.error('Outbound call error', error);
        return {
            success: false,
            error: 'call_failed',
            message: error.message || 'Failed to initiate call'
        };
    }
}

module.exports = {
    getCallLogs,
    getCallStatus,
    getCallSessions,
    getCallSession,
    initiateOutboundCall,
    handleConnection,
    regenerateSummary,
    completeCallSession
};