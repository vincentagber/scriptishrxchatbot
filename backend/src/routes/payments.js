const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const paymentService = require('../services/paymentService');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// Paystack Webhook
router.post('/webhook', async (req, res) => {
    const signature = req.headers['x-paystack-signature'];
    const secret = process.env.PAYSTACK_SECRET_KEY;

    if (!secret || !signature) {
        return res.status(400).send('Webhook Error: Configuration missing');
    }

    // Verify Signature using rawBody captured in app.js
    const hash = crypto.createHmac('sha512', secret)
        .update(req.rawBody || JSON.stringify(req.body)) // Fallback if rawBody missing (dev/test)
        .digest('hex');

    if (hash !== signature) {
        logger.warn('Webhook Error: Invalid Signature');
        return res.status(400).send('Invalid Signature');
    }

    const event = req.body; // Already parsed by global middleware

    try {
        if (event.event === 'charge.success') {
            await paymentService.verifyTransaction(event.data.reference);
        }
        res.status(200).send({ received: true });
    } catch (err) {
        logger.error(`Webhook Processing Failed: ${err.message}`);
        res.status(500).send(`Server Error: ${err.message}`);
    }
});

// Create Checkout Session
router.post('/create-session', authenticateToken, async (req, res, next) => {
    try {
        const { plan, cycle } = req.body;
        if (!plan) throw new AppError('Plan is required', 400);

        const { url, reference } = await paymentService.initiateTransaction(req.user.userId, plan, cycle);

        res.json({ url, reference });
    } catch (error) {
        next(error);
    }
});

// Portal
router.post('/portal', authenticateToken, async (req, res, next) => {
    try {
        const { url } = await paymentService.createPortalSession(req.user.userId);
        res.json({ url });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
