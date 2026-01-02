const twilio = require('twilio');
const prisma = require('../lib/prisma');
const chatService = require('./chatService');

class TwilioService {
    /**
     * Get Twilio Client for a specific tenant
     * Falls back to global env vars if tenant has no specific config
     */
    async getClientForTenant(tenantId) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { twilioConfig: true }
        });

        const config = tenant?.twilioConfig || {};
        const accountSid = config.accountSid || process.env.TWILIO_ACCOUNT_SID;
        const apiKeySid = config.apiKeySid || process.env.TWILIO_API_KEY_SID;
        const apiKeySecret = config.apiKeySecret || process.env.TWILIO_API_KEY_SECRET;
        const authToken = config.authToken || process.env.TWILIO_AUTH_TOKEN;

        // Fallback for demo/development if no numbers configured
        // In production, force correct credentials
        if (!process.env.NODE_ENV === 'production' && !accountSid) {
            console.warn('Twilio credentials missing in dev, using mocks');
            return null;
        }

        if (!accountSid) {
            throw new Error('Twilio Account SID not found for tenant or environment.');
        }

        let client;
        if (apiKeySid && apiKeySecret) {
            // Production Preferred: using API Key
            client = twilio(apiKeySid, apiKeySecret, { accountSid });
        } else if (authToken) {
            // Standard: using Auth Token
            client = twilio(accountSid, authToken);
        } else {
            throw new Error('Twilio credentials (Auth Token or API Key) missing.');
        }

        return {
            client,
            phoneNumber: config.phoneNumber || process.env.TWILIO_PHONE_NUMBER,
            accountSid
        };
    }

    /**
     * Send SMS
     */
    async sendSms(tenantId, to, body) {
        try {
            const { client, phoneNumber } = await this.getClientForTenant(tenantId);

            if (!phoneNumber) {
                throw new Error('No Twilio phone number configured.');
            }

            const message = await client.messages.create({
                body,
                from: phoneNumber,
                to
            });

            console.log(`[Twilio] SMS sent for Tenant ${tenantId}: ${message.sid}`);
            return message;
        } catch (error) {
            console.error('[Twilio] SMS Error:', error);
            throw error;
        }
    }

    /**
     * Make Outbound Call
     */
    async makeCall(tenantId, to, script, customData = {}) {
        try {
            const { client, phoneNumber } = await this.getClientForTenant(tenantId);
            const webhookUrl = `${process.env.APP_URL}/api/twilio/webhook/voice/outbound`; // We need to create this route

            const call = await client.calls.create({
                url: `${webhookUrl}?script=${encodeURIComponent(script)}`,
                to,
                from: phoneNumber
            });

            console.log(`[Twilio] Call initiated for Tenant ${tenantId}: ${call.sid}`);
            return call;
        } catch (error) {
            console.error('[Twilio] Call Error:', error);
            throw error;
        }
    }

    /**
     * Handle Inbound Voice Webhook
     * This is called by Twilio when a number receives a call
     */
    async handleInboundVoice(params) {
        const { To, From, CallSid } = params;
        console.log(`[Twilio] Inbound call from ${From} to ${To} (Sid: ${CallSid})`);

        const voiceResponse = new twilio.twiml.VoiceResponse();

        // Connect to Media Stream for AI processing
        const host = process.env.APP_URL ? process.env.APP_URL.replace('https://', '').replace('http://', '') : 'localhost:5000';
        const startStream = voiceResponse.connect();
        startStream.stream({
            url: `wss://${host}/api/voice/stream`
        });

        // Pass context via Twilio parameters
        const tenant = await prisma.tenant.findFirst({
            where: { phoneNumber: To },
            select: { id: true }
        });

        if (tenant) {
            startStream.stream.parameter({
                name: 'tenantId',
                value: tenant.id
            });
        }

        return voiceResponse.toString();
    }

    /**
     * Handle Inbound SMS Webhook
     * Saves messages to unified history and processes with AI
     */
    async handleInboundSms(params) {
        const { To, From, Body, MessageSid } = params;
        console.log(`[Twilio] Inbound SMS from ${From} to ${To}: ${Body}`);

        const tenant = await prisma.tenant.findFirst({
            where: { phoneNumber: To }
        });

        if (!tenant) {
            console.warn(`[Twilio] Inbound SMS to unknown number: ${To}`);
            return null;
        }

        // Create session ID based on phone number for threading
        const sessionId = `sms_${From.replace(/\D/g, '')}`;

        // Save incoming message to database with SMS source
        try {
            await prisma.message.create({
                data: {
                    tenantId: tenant.id,
                    sessionId,
                    role: 'user',
                    content: Body,
                    source: 'sms'
                }
            });
        } catch (e) {
            console.error('[Twilio] Error saving inbound SMS:', e);
        }

        // Process with ChatService (includes source in options)
        const response = await chatService.processMessage(Body, tenant.id);

        if (response.success && response.response) {
            // Save AI response to database
            try {
                await prisma.message.create({
                    data: {
                        tenantId: tenant.id,
                        sessionId,
                        role: 'assistant',
                        content: response.response,
                        source: 'sms'
                    }
                });
            } catch (e) {
                console.error('[Twilio] Error saving outbound SMS:', e);
            }

            // Reply via SMS
            await this.sendSms(tenant.id, From, response.response);
        }

        return { success: true, sessionId };
    }

    /**
     * Get SMS conversation history for a phone number
     */
    async getSmsConversation(tenantId, phoneNumber) {
        const sessionId = `sms_${phoneNumber.replace(/\D/g, '')}`;

        const messages = await prisma.message.findMany({
            where: {
                tenantId,
                sessionId,
                source: 'sms'
            },
            orderBy: { createdAt: 'asc' }
        });

        return messages;
    }

    /**
     * Get real-time call status from Twilio
     * @param {string} tenantId - Tenant ID
     * @param {string} callSid - Twilio Call SID
     */
    async getCallStatus(tenantId, callSid) {
        try {
            const { client } = await this.getClientForTenant(tenantId);
            const call = await client.calls(callSid).fetch();

            return {
                callSid: call.sid,
                status: call.status,
                from: call.from,
                to: call.to,
                startTime: call.startTime,
                endTime: call.endTime,
                duration: call.duration,
                price: call.price,
                direction: call.direction,
                queueTime: call.queueTime
            };
        } catch (error) {
            console.error(`[Twilio] Error fetching status for call ${callSid}:`, error.message);
            throw new Error(`Failed to fetch call status: ${error.message}`);
        }
    }

    /**
     * Handle DTMF Input (Gather)
     * Processes digit inputs from the user during a call
     */
    async handleGatherInput(params) {
        const { Digits, CallSid } = params;
        console.log(`[Twilio] Input received for ${CallSid}: ${Digits}`);

        const response = new twilio.twiml.VoiceResponse();

        // Example logic: customized based on requirements
        switch (Digits) {
            case '1':
                response.say('You pressed 1. Connecting you to support.');
                // Add dial logic here
                break;
            case '2':
                response.say('You pressed 2. Leaving a message.');
                response.record({
                    transcribe: true,
                    maxLength: 30
                });
                break;
            default:
                response.say('Invalid option. Please try again.');
                response.redirect(`${process.env.APP_URL}/api/twilio/webhook/voice`); // Re-prompt
        }

        return response.toString();
    }

    /**
     * List available phone numbers for a tenant account
     * Used for dashboard number selection
     */
    async getPhoneNumbers(tenantId, limit = 20) {
        try {
            const { client } = await this.getClientForTenant(tenantId);

            // List incoming numbers owned by the account
            const numbers = await client.incomingPhoneNumbers.list({ limit });

            return numbers.map(num => ({
                sid: num.sid,
                phoneNumber: num.phoneNumber,
                friendlyName: num.friendlyName,
                capabilities: num.capabilities,
                voiceUrl: num.voiceUrl,
                smsUrl: num.smsUrl,
                status: num.status
            }));
        } catch (error) {
            console.error('[Twilio] Error listing numbers:', error);
            throw error;
        }
    }

    /**
     * Get aggregate call statistics
     * Replaces the old VoiceCake stats endpoint
     */
    async getCallStats(tenantId, { startDate, endDate } = {}) {
        // Since we can't easily query Twilio for aggregate stats effectively without many API calls,
        // we should prefer our database records if available (CallSession model).
        // Falling back to a basic DB query:

        const where = { tenantId };
        if (startDate && endDate) {
            where.startedAt = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        const stats = await prisma.callSession.aggregate({
            where,
            _count: {
                id: true
            },
            _avg: {
                duration: true
            }
        });

        // Break down by status
        const byStatus = await prisma.callSession.groupBy({
            by: ['status'],
            where,
            _count: { id: true }
        });

        const statusCounts = byStatus.reduce((acc, curr) => {
            acc[curr.status] = curr._count.id;
            return acc;
        }, {});

        return {
            totalCalls: stats._count.id || 0,
            avgDuration: Math.round(stats._avg.duration || 0),
            completed: statusCounts.completed || 0,
            failed: statusCounts.failed || 0,
            inProgress: statusCounts.in_progress || 0,
            // Mocking cost if not stored
            estimatedCost: ((stats._count.id || 0) * 0.01).toFixed(2)
        };
    }

    /**
     * Hang up an active call
     */
    async hangupCall(tenantId, callSid) {
        try {
            const { client } = await this.getClientForTenant(tenantId);

            // Update status to completed to end the call
            const call = await client.calls(callSid).update({
                status: 'completed'
            });

            // Also update our DB record if it exists
            await prisma.callSession.updateMany({
                where: { callSid, tenantId },
                data: { status: 'completed', endedAt: new Date() }
            });

            return { success: true, status: call.status };
        } catch (error) {
            console.error(`[Twilio] Failed to hangup call ${callSid}:`, error);
            throw error;
        }
    }

    /**
     * Update webhook URL for a specific phone number
     * Essential for configuring new numbers automatically
     */
    async updatePhoneNumberWebhook(tenantId, phoneNumberSid, webhookUrl) {
        try {
            const { client } = await this.getClientForTenant(tenantId);

            const number = await client.incomingPhoneNumbers(phoneNumberSid).update({
                voiceUrl: webhookUrl,
                voiceMethod: 'POST',
                smsUrl: webhookUrl.replace('/voice', '/sms'), // infer SMS webhook
                smsMethod: 'POST'
            });

            return {
                sid: number.sid,
                phoneNumber: number.phoneNumber,
                voiceUrl: number.voiceUrl,
                smsUrl: number.smsUrl
            };
        } catch (error) {
            console.error('[Twilio] Error updating webhook:', error);
            throw error;
        }
    }
}

module.exports = new TwilioService();
