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
            url: `wss://${req.get('host')}/media-stream`
        });

        // Pass custom parameters to the stream
        stream.parameter({ name: 'tenantId', value: req.query.tenantId });

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

module.exports = router;
