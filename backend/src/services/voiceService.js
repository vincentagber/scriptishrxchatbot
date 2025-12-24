// backend/src/services/voiceService.js
const twilioService = require('./twilioService');
const prisma = require('../lib/prisma');
const WebSocket = require('ws');

// In-memory storage for call logs
const callLogs = [];

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
 * Handle WebSocket Connection for Twilio Media Stream + OpenAI Realtime
 */
function handleConnection(ws, req) {
    console.log('[VoiceService] New Media Stream Connection');

    let streamSid = null;
    let openAiWs = null;

    // Connect to OpenAI Realtime API
    try {
        const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";
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

        // Initialize Session
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
            }
        };
        openAiWs.send(JSON.stringify(sessionUpdate));
    });

    openAiWs.on('message', (data) => {
        try {
            const response = JSON.parse(data);

            if (response.type === 'response.audio.delta' && response.delta) {
                // Determine Stream SID to send back to (Twilio)
                if (streamSid) {
                    const audioDelta = {
                        event: 'media',
                        streamSid: streamSid,
                        media: { payload: response.delta }
                    };
                    ws.send(JSON.stringify(audioDelta));
                }
            }

            // Log for debugging
            if (response.type === 'response.done') {
                console.log('[OpenAI] Response completed');
            }
        } catch (e) {
            console.error('[OpenAI] Error parsing message:', e);
        }
    });

    openAiWs.on('error', (error) => {
        console.error('[OpenAI] WebSocket error:', error);
    });

    // Twilio Handlers (Client -> Server)
    ws.on('message', async (message) => {
        try {
            const msg = JSON.parse(message);
            switch (msg.event) {
                case 'start':
                    streamSid = msg.start.streamSid;
                    console.log(`[Twilio] Stream started: ${streamSid}`);
                    // Fetch Tenant Config to update System Prompt
                    if (msg.start.customParameters && msg.start.customParameters.tenantId) {
                        const tenantId = msg.start.customParameters.tenantId;
                        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { aiConfig: true, name: true } });
                        if (tenant) {
                            const instructions = tenant.aiConfig?.systemPrompt || `You are the AI assistant for ${tenant.name}.`;
                            // Update instructions dynamically
                            if (openAiWs.readyState === WebSocket.OPEN) {
                                openAiWs.send(JSON.stringify({
                                    type: 'session.update',
                                    session: { instructions }
                                }));
                            }
                        }
                    }
                    break;
                case 'media':
                    if (openAiWs.readyState === WebSocket.OPEN) {
                        const audioAppend = {
                            type: 'input_audio_buffer.append',
                            audio: msg.media.payload
                        };
                        openAiWs.send(JSON.stringify(audioAppend));
                    }
                    break;
                case 'stop':
                    console.log(`[Twilio] Stream stopped: ${msg.stop.streamSid}`);
                    if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
                    break;
            }
        } catch (e) {
            console.error('[VoiceService] Error parsing message:', e);
        }
    });

    ws.on('close', () => {
        console.log('[VoiceService] Client disconnected');
        if (openAiWs && openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
    });
}

/**
 * Initiate outbound call via Twilio
 */
async function initiateOutboundCall(phoneNumber, tenantId, customData = {}) {
    // ... Implement logic if needed, but primary focus is Inbound
    console.log("Outbound call not fully implemented in Realtime demo yet");
    return { success: false, message: "Outbound not ready" };
}

module.exports = {
    getCallLogs,
    getCallStatus,
    initiateOutboundCall,
    handleConnection
};