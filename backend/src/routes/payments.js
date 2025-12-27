const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const prisma = require('../lib/prisma');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

const auth = require('../lib/authMiddleware');

// Stripe Webhook (Must be before auth middleware)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];

    // Safety check for missing secrets or stripe instance
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
        console.warn('Webhook received but Stripe not configured.');
        return res.json({ received: true, mock: true });
    }

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Signature Verification Failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        await paymentService.handleWebhookEvent(event);
        res.json({ received: true });
    } catch (error) {
        console.error('Webhook Handler Error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// Secure all other routes
router.use(auth);

// Create Subscription (Checkout Session)
router.post('/subscribe', async (req, res) => {
    try {
        const { plan } = req.body;
        const userId = req.user.userId;

        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) return res.status(404).json({ error: 'User not found' });

        const result = await paymentService.createCheckoutSession(user, plan);

        // If mock, save DB record immediately (DEV ONLY)
        if (result.mock) {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('🔴 Security Error: Mock payments are disabled in Production.');
            }

            await prisma.subscription.upsert({
                where: { userId: userId },
                update: {
                    plan,
                    status: 'Active',
                    startDate: new Date(),
                    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1))
                },
                create: {
                    userId: userId,
                    plan,
                    status: 'Active',
                    startDate: new Date(),
                    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1))
                }
            });
        }

        res.json(result);
    } catch (error) {
        console.error('Error creating subscription:', error);
        res.status(500).json({ error: 'Subscription failed' });
    }
});

// Customer Portal
router.post('/portal', async (req, res) => {
    try {
        const userId = req.user.userId;
        const result = await paymentService.createPortalSession(userId);
        res.json(result);
    } catch (error) {
        console.error('Error creating portal session:', error);
        res.status(500).json({ error: 'Failed to create portal session' });
    }
});

// Mock PayPal (Keep for completeness)
router.post('/paypal/create-order', async (req, res) => {
    res.json({ id: `mock_paypal_order_${Date.now()}`, status: 'CREATED' });
});

module.exports = router;
