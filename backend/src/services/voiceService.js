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

// In-memory storage for call logs (legacy support)
const callLogs = [];

// Active call sessions for transcript collection
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

/**
 * Handle WebSocket Connection for Twilio Media Stream + OpenAI Realtime
 * Enhanced with transcript collection and function calling
 */
function handleConnection(ws, req) {
    console.log('[VoiceService] New Media Stream Connection');

    let streamSid = null;
    let openAiWs = null;
    let callSessionId = null;
    let tenantId = null;
    let callerPhone = null;
    let startTime = Date.now();

    // Transcript collection
    const transcriptParts = [];
    let currentSpeaker = null;

    // Connect to OpenAI Realtime API
    try {
        const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17";
        openAiWs = new WebSocket(url, {
            headers: {
                "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
                "OpenAI-Beta": "realtime=v1",
            },
        });
    } catch (error) {
        console.error("[VoiceService] Failed to connect to OpenAI:", error);
        ws.close();
        return;
    }

    // OpenAI Handlers
    openAiWs.on('open', () => {
        console.log('[VoiceService] Connected to OpenAI Realtime API');

        // Initialize Session with tools
        const sessionUpdate = {
            type: 'session.update',
            session: {
                turn_detection: { type: 'server_vad' },
                input_audio_format: 'g711_ulaw',
                output_audio_format: 'g711_ulaw',
                voice: 'alloy',
                instructions: 'You are a helpful AI assistant. Answer concisely and professionally.',
                modalities: ["text", "audio"],
                temperature: 0.8,
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
                case 'response.audio.delta':
                    // Stream audio back to Twilio
                    if (response.delta && streamSid) {
                        const audioDelta = {
                            event: 'media',
                            streamSid: streamSid,
                            media: { payload: response.delta }
                        };
                        ws.send(JSON.stringify(audioDelta));
                    }
                    break;

                case 'response.audio_transcript.done':
                    // Capture AI's spoken response for transcript
                    if (response.transcript) {
                        transcriptParts.push({
                            role: 'assistant',
                            content: response.transcript,
                            timestamp: Date.now()
                        });

                        // Save to database as message
                        if (callSessionId && tenantId) {
                            await saveTranscriptMessage(
                                tenantId,
                                callSessionId,
                                'assistant',
                                response.transcript
                            );
                        }
                    }
                    break;

                case 'conversation.item.input_audio_transcription.completed':
                    // Capture user's spoken input for transcript
                    if (response.transcript) {
                        transcriptParts.push({
                            role: 'user',
                            content: response.transcript,
                            timestamp: Date.now()
                        });

                        // Save to database as message
                        if (callSessionId && tenantId) {
                            await saveTranscriptMessage(
                                tenantId,
                                callSessionId,
                                'user',
                                response.transcript
                            );
                        }
                    }
                    break;

                case 'response.function_call_arguments.done':
                    // Handle function call from AI
                    console.log('[VoiceService] Function call:', response.name);

                    const toolResult = await agentToolsService.executeTool(
                        response.name,
                        JSON.parse(response.arguments || '{}'),
                        { tenantId, callerPhone, callSessionId }
                    );

                    // Send tool result back to OpenAI
                    if (openAiWs.readyState === WebSocket.OPEN) {
                        openAiWs.send(JSON.stringify({
                            type: 'conversation.item.create',
                            item: {
                                type: 'function_call_output',
                                call_id: response.call_id,
                                output: JSON.stringify(toolResult)
                            }
                        }));

                        // Trigger response generation
                        openAiWs.send(JSON.stringify({ type: 'response.create' }));
                    }
                    break;

                case 'response.done':
                    console.log('[OpenAI] Response completed');
                    break;

                case 'error':
                    console.error('[OpenAI] Error:', response.error);
                    break;
            }
        } catch (e) {
            console.error('[VoiceService] Error processing OpenAI message:', e);
        }
    });

    openAiWs.on('error', (error) => {
        console.error('[OpenAI] WebSocket error:', error);
    });

    openAiWs.on('close', () => {
        console.log('[OpenAI] WebSocket closed');
    });

    // Twilio Handlers (Client -> Server)
    ws.on('message', async (message) => {
        try {
            const msg = JSON.parse(message);

            switch (msg.event) {
                case 'start':
                    streamSid = msg.start.streamSid;
                    console.log(`[Twilio] Stream started: ${streamSid}`);

                    // Extract call parameters
                    const params = msg.start.customParameters || {};
                    tenantId = params.tenantId;
                    callerPhone = params.From || msg.start.from;
                    const callSid = params.CallSid || msg.start.callSid;

                    // Create call session in database
                    if (tenantId && callSid) {
                        try {
                            // Look up caller as client
                            let clientId = null;
                            if (callerPhone) {
                                const client = await prisma.client.findFirst({
                                    where: {
                                        tenantId,
                                        phone: { contains: callerPhone.slice(-10) }
                                    }
                                });
                                if (client) clientId = client.id;
                            }

                            const session = await prisma.callSession.create({
                                data: {
                                    tenantId,
                                    clientId,
                                    callSid,
                                    callerPhone,
                                    status: 'in_progress',
                                    direction: 'inbound',
                                    startedAt: new Date()
                                }
                            });
                            callSessionId = session.id;
                            activeSessions.set(streamSid, { callSessionId, tenantId });

                            console.log(`[VoiceService] Call session created: ${callSessionId}`);
                        } catch (e) {
                            console.error('[VoiceService] Error creating call session:', e);
                        }
                    }

                    // Fetch Tenant Config to update System Prompt
                    if (tenantId) {
                        const tenant = await prisma.tenant.findUnique({
                            where: { id: tenantId },
                            select: { aiConfig: true, name: true }
                        });

                        if (tenant) {
                            const aiConfig = tenant.aiConfig || {};
                            let instructions = aiConfig.systemPrompt ||
                                `You are the AI assistant for ${tenant.name}. Be helpful, professional, and concise.`;

                            // Add caller context if known
                            if (callerPhone) {
                                const client = await prisma.client.findFirst({
                                    where: { tenantId, phone: { contains: callerPhone.slice(-10) } },
                                    select: { name: true }
                                });
                                if (client) {
                                    instructions += `\n\nThe caller is ${client.name}, a returning customer.`;
                                }
                            }

                            // Append FAQs to instructions
                            if (aiConfig.faqs && Array.isArray(aiConfig.faqs) && aiConfig.faqs.length > 0) {
                                instructions += `\n\nKnowledge Base:\n${aiConfig.faqs.map(f => `- ${f.question}: ${f.answer}`).join('\n')}`;
                            }

                            // Update OpenAI session with tenant config
                            if (openAiWs.readyState === WebSocket.OPEN) {
                                openAiWs.send(JSON.stringify({
                                    type: 'session.update',
                                    session: {
                                        instructions,
                                        voice: aiConfig.voiceId || 'alloy'
                                    }
                                }));
                            }
                        }
                    }
                    break;

                case 'media':
                    // Forward audio to OpenAI
                    if (openAiWs.readyState === WebSocket.OPEN) {
                        const audioAppend = {
                            type: 'input_audio_buffer.append',
                            audio: msg.media.payload
                        };
                        openAiWs.send(JSON.stringify(audioAppend));
                    }
                    break;

                case 'stop':
                    console.log(`[Twilio] Stream stopped: ${msg.stop?.streamSid || streamSid}`);

                    // Complete the call session
                    if (callSessionId) {
                        await completeCallSession(callSessionId, transcriptParts, startTime);
                    }

                    if (openAiWs.readyState === WebSocket.OPEN) {
                        openAiWs.close();
                    }
                    break;
            }
        } catch (e) {
            console.error('[VoiceService] Error parsing Twilio message:', e);
        }
    });

    ws.on('close', async () => {
        console.log('[VoiceService] Client disconnected');

        // Complete call session if still in progress
        if (callSessionId) {
            await completeCallSession(callSessionId, transcriptParts, startTime);
        }

        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) {
            openAiWs.close();
        }

        if (streamSid) {
            activeSessions.delete(streamSid);
        }
    });

    ws.on('error', (error) => {
        console.error('[VoiceService] WebSocket error:', error);
    });
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
        console.error('[VoiceService] Error saving transcript message:', e);
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

        console.log(`[VoiceService] Call session completed: ${callSessionId} (${duration}s)`);

        // Generate summary asynchronously (don't block)
        if (transcript && transcript.length > 50) {
            setImmediate(async () => {
                try {
                    await summarizeService.processCompletedCall(callSessionId, {
                        createMeetingMinute: false // Set to true to auto-create meeting minutes
                    });
                } catch (e) {
                    console.error('[VoiceService] Error generating post-call summary:', e);
                }
            });
        }
    } catch (e) {
        console.error('[VoiceService] Error completing call session:', e);
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

        console.log(`[VoiceService] Initiating outbound call to ${phoneNumber} from ${fromNumber}`);

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

        console.log(`[VoiceService] Outbound call created: ${call.sid}`);

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
        console.error('[VoiceService] Outbound call error:', error);
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