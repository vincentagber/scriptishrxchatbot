const express = require('express');
const router = express.Router();
const twilioService = require('../services/twilioService');

// Middleware to validate Twilio Request Signature (Optional for now, good for security later)
// const twilio = require('twilio');
// const validateTwilio = twilio.webhook({ validate: process.env.NODE_ENV === 'production' });

// Inbound Voice Webhook
router.post('/webhook/voice', async (req, res) => {
    try {
        const twiml = await twilioService.handleInboundVoice(req.body);
        res.type('text/xml');
        res.send(twiml);
    } catch (error) {
        console.error('Twilio Voice Webhook Error:', error);
        res.status(500).send('Error');
    }
});

// Inbound SMS Webhook
router.post('/webhook/sms', async (req, res) => {
    try {
        await twilioService.handleInboundSms(req.body);
        res.type('text/xml');
        res.send('<Response></Response>'); // Empty response as we reply asynchronously via API if needed
    } catch (error) {
        console.error('Twilio SMS Webhook Error:', error);
        res.status(500).send('Error');
    }
});

// Gather Action (User spoke something)
// Gather Action (User spoke something)
router.post('/webhook/voice/gather', async (req, res) => {
    try {
        const tenantId = req.query.tenantId;
        const speechResult = req.body.SpeechResult;

        console.log(`[Twilio] Gather Result for Tenant ${tenantId}: "${speechResult}"`);

        // Use ChatService/OpenAI to determine next response
        const chatService = require('../services/chatService');
        const VoiceResponse = require('twilio').twiml.VoiceResponse;
        const response = new VoiceResponse();

        if (speechResult) {
            // Get AI Response
            const aiResult = await chatService.processMessage(speechResult, tenantId);
            const aiSpeech = aiResult.success ? aiResult.response : "I'm sorry, I'm having trouble connecting right now.";

            response.say({ voice: 'alice' }, aiSpeech);
        } else {
            // No speech detected? Just prompt again
            // response.say({ voice: 'alice' }, "I didn't catch that.");
        }

        // Loop: Listen again
        const gather = response.gather({
            input: 'speech',
            action: `${process.env.APP_URL}/api/twilio/webhook/voice/gather?tenantId=${tenantId}`,
            method: 'POST',
            timeout: 2,
            language: 'en-US'
        });

        // Loop redirect if timeout
        response.redirect(`${process.env.APP_URL}/api/twilio/webhook/voice/gather?tenantId=${tenantId}`);

        res.type('text/xml');
        res.send(response.toString());
    } catch (error) {
        console.error('Twilio Gather Error:', error);
        res.status(500).send('Error');
    }
});

// Outbound Call Webhook (Called when Twilio connects the call)
router.post('/webhook/voice/outbound', (req, res) => {
    try {
        const script = req.query.script || 'Hello from ScriptishRx.';
        const VoiceResponse = require('twilio').twiml.VoiceResponse;
        const response = new VoiceResponse();

        response.say({ voice: 'alice' }, script);
        // Keep line open or record? For now, pause then hangup.
        response.pause({ length: 1 });


        // const startStream = response.connect();
        // startStream.stream({ url: `wss://${req.get('host')}/media-stream` });

        res.type('text/xml');
        res.send(response.toString());
    } catch (error) {
        console.error('Twilio Outbound Webhook Error:', error);
        res.status(500).send('Error');
    }
});

// Status Callback - Updates call session in database
router.post('/webhook/status', async (req, res) => {
    try {
        const { CallSid, CallStatus, CallDuration } = req.body;
        console.log(`[Twilio] Call Status ${CallSid}: ${CallStatus} (${CallDuration || 0}s)`);

        // Update call session in database
        const prisma = require('../lib/prisma');
        const session = await prisma.callSession.findFirst({
            where: { callSid: CallSid }
        });

        if (session) {
            const updates = {};

            if (CallStatus === 'completed' || CallStatus === 'busy' || CallStatus === 'no-answer' || CallStatus === 'failed') {
                updates.status = CallStatus === 'completed' ? 'completed' : 'failed';
                updates.endedAt = new Date();
                if (CallDuration) updates.duration = parseInt(CallDuration);
            }

            if (Object.keys(updates).length > 0) {
                await prisma.callSession.update({
                    where: { id: session.id },
                    data: updates
                });
            }
        }

        res.status(200).end();
    } catch (error) {
        console.error('Twilio Status Callback Error:', error);
        res.status(500).send('Error');
    }
});

// Outbound Call with Media Stream - Connects to AI voice agent
router.post('/webhook/voice/outbound-stream', async (req, res) => {
    try {
        const tenantId = req.query.tenantId;
        const VoiceResponse = require('twilio').twiml.VoiceResponse;
        const response = new VoiceResponse();

        // Get tenant config for personalized greeting
        const prisma = require('../lib/prisma');
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { aiConfig: true, name: true }
        });

        const aiConfig = tenant?.aiConfig || {};
        const greeting = aiConfig.welcomeMessage || `Hello, this is ${tenant?.name || 'your AI assistant'} calling.`;

        // Optional: Initial greeting before connecting to AI
        response.say({ voice: 'Polly.Joanna' }, greeting);

        // Connect to WebSocket media stream for AI processing
        const host = process.env.APP_URL
            ? process.env.APP_URL.replace('https://', '').replace('http://', '')
            : req.get('host');

        const connect = response.connect();
        const stream = connect.stream({
            url: `wss://${host}/media-stream`
        });

        // Pass tenant context for AI configuration
        stream.parameter({ name: 'tenantId', value: tenantId });
        stream.parameter({ name: 'direction', value: 'outbound' });
        stream.parameter({ name: 'CallSid', value: req.body.CallSid });

        console.log(`[Twilio] Outbound call connecting to media stream for tenant ${tenantId}`);

        res.type('text/xml');
        res.send(response.toString());
    } catch (error) {
        console.error('Twilio Outbound Stream Webhook Error:', error);

        // Fallback: Simple message if stream fails
        const VoiceResponse = require('twilio').twiml.VoiceResponse;
        const response = new VoiceResponse();
        response.say({ voice: 'Polly.Joanna' }, 'We are experiencing technical difficulties. Please try again later.');
        response.hangup();

        res.type('text/xml');
        res.send(response.toString());
    }
});

module.exports = router;
