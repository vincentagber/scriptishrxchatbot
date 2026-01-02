const express = require('express');
const router = express.Router();
const twilioService = require('../services/twilioService');
const twilio = require('twilio');
const logger = require('../lib/logger')('TwilioRoutes');

// Middleware to validate Twilio Request Signature
// In production, this ensures requests actually come from Twilio
const validateTwilio = twilio.webhook({
    validate: process.env.NODE_ENV === 'production',
    // Optional: override host if behind proxy, but standard validation usually suffices
});

// Inbound Voice Webhook - Protected
router.post('/webhook/voice', validateTwilio, async (req, res) => {
    try {
        const twiml = await twilioService.handleInboundVoice(req.body);
        res.setHeader('Content-Encoding', 'identity');
        res.type('text/xml');
        res.send(twiml);
    } catch (error) {
        logger.error('Twilio Voice Webhook Error', error);
        res.status(500).send('Error');
    }
});

// Outbound Stream Webhook - Protected
router.post('/webhook/voice/outbound-stream', validateTwilio, async (req, res) => {
    try {
        // Generate TwiML to connect to the media stream
        const twiml = new twilio.twiml.VoiceResponse();
        const connect = twiml.connect();
        const stream = connect.stream({
            url: `wss://${req.get('host')}/api/voice/stream`
        });

        // Pass custom parameters to the stream
        stream.parameter({ name: 'tenantId', value: req.query.tenantId });

        res.setHeader('Content-Encoding', 'identity');
        res.type('text/xml');
        res.send(twiml.toString());
    } catch (error) {
        logger.error('Twilio Outbound Stream Webhook Error', error);
        res.status(500).send('Error');
    }
});

// Inbound SMS Webhook - Protected
router.post('/webhook/sms', validateTwilio, async (req, res) => {
    try {
        await twilioService.handleInboundSMS(req.body);
        res.type('text/xml');
        res.send('<Response></Response>');
    } catch (error) {
        logger.error('Twilio SMS Webhook Error', error);
        res.status(500).send('Error');
    }
});

// Gather input Webhook - Protected
router.post('/webhook/voice/gather', validateTwilio, async (req, res) => {
    try {
        const twiml = await twilioService.handleGatherInput(req.body);
        res.type('text/xml');
        res.send(twiml);
    } catch (error) {
        logger.error('Twilio Gather Webhook Error', error);
        res.status(500).send('Error');
    }
});

// Status Callback Webhook - Protected
router.post('/webhook/status', validateTwilio, async (req, res) => {
    try {
        logger.info('Call Status Update', req.body);
        // Logic to update call status in DB can go here
        res.sendStatus(200);
    } catch (error) {
        logger.error('Twilio Status Webhook Error', error);
        res.sendStatus(500);
    }
});

const { authenticateToken } = require('../middleware/auth');

/* ==========================================================================
   PUBLIC / HEALTH
   ========================================================================== */

router.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'Twilio' });
});

/* ==========================================================================
   AUTHENTICATED API ENDPOINTS
   ========================================================================== */

// Get Call Status
router.get('/call/:callSid/status', authenticateToken, async (req, res) => {
    try {
        const { callSid } = req.params;
        const tenantId = req.user.tenantId;
        const status = await twilioService.getCallStatus(tenantId, callSid);
        res.json(status);
    } catch (error) {
        logger.error('Error fetching call status', error);
        res.status(500).json({ error: error.message });
    }
});

// Hangup Call
router.post('/call/:callSid/hangup', authenticateToken, async (req, res) => {
    try {
        const { callSid } = req.params;
        const tenantId = req.user.tenantId;
        const result = await twilioService.hangupCall(tenantId, callSid);
        res.json(result);
    } catch (error) {
        logger.error('Error hanging up call', error);
        res.status(500).json({ error: error.message });
    }
});

// List Phone Numbers
router.get('/phone-numbers', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const numbers = await twilioService.getPhoneNumbers(tenantId, 20);
        res.json(numbers);
    } catch (error) {
        logger.error('Error fetching phone numbers', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Stats
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { startDate, endDate } = req.query;
        const stats = await twilioService.getCallStats(tenantId, { startDate, endDate });
        res.json(stats);
    } catch (error) {
        logger.error('Error fetching stats', error);
        res.status(500).json({ error: error.message });
    }
});

// Update Webhook
router.post('/phone-numbers/:sid/webhook', authenticateToken, async (req, res) => {
    try {
        const { sid } = req.params;
        const { webhookUrl } = req.body;
        const tenantId = req.user.tenantId;

        if (!webhookUrl) return res.status(400).json({ error: 'webhookUrl is required' });

        const result = await twilioService.updatePhoneNumberWebhook(tenantId, sid, webhookUrl);
        res.json(result);
    } catch (error) {
        logger.error('Error updating webhook', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
