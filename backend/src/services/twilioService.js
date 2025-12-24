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
    async makeCall(tenantId, to, script) {
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
            url: `wss://${host}/media-stream`
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
     */
    async handleInboundSms(params) {
        const { To, From, Body } = params;
        console.log(`[Twilio] Inbound SMS from ${From} to ${To}: ${Body}`);

        const tenant = await prisma.tenant.findFirst({
            where: { phoneNumber: To }
        });

        if (!tenant) {
            console.warn(`[Twilio] Inbound SMS to unknown number: ${To}`);
            return null;
        }

        // Process with ChatService
        const response = await chatService.processMessage(Body, tenant.id);

        if (response.success && response.response) {
            // Reply via SMS
            await this.sendSms(tenant.id, From, response.response);
        }
    }
}

module.exports = new TwilioService();
