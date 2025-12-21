const prisma = require('../lib/prisma');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

class PaymentService {
    constructor() {
        if (!stripe) {
            console.warn('⚠️ PaymentService: STRIPE_SECRET_KEY missing. Payments unavailable.');
        }
    }

    async createCheckoutSession(user, plan) {
        if (!stripe) {
            throw new Error('Payment processing unavailable: Stripe configuration missing.');
        }

        // Map plan to Price ID (Use env vars in real app)
        const prices = {
            'Basic': process.env.STRIPE_PRICE_BASIC || 'price_basic_id',
            'Intermediate': process.env.STRIPE_PRICE_INTERMEDIATE || 'price_intermediate_id',
            'Advanced': process.env.STRIPE_PRICE_ADVANCED || 'price_advanced_id'
        };

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: user.email,
            line_items: [{ price: prices[plan], quantity: 1 }],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings`,
            metadata: {
                userId: user.id,
                tenantId: user.tenantId,
                plan: plan
            }
        });

        return { url: session.url };
    }

    async createPortalSession(userId) {
        const subscription = await prisma.subscription.findUnique({ where: { userId } });

        if (!stripe || !subscription?.stripeId) {
            throw new Error('Billing portal unavailable.');
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: subscription.stripeId, // stored customer ID
            return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings`,
        });

        return { url: session.url };
    }

    async handleWebhookEvent(event) {
        switch (event.type) {
            case 'checkout.session.completed':
                await this.handleCheckoutCompleted(event.data.object);
                break;
            case 'invoice.payment_succeeded':
                await this.handleInvoicePaymentSucceeded(event.data.object);
                break;
            case 'customer.subscription.deleted':
                await this.handleSubscriptionDeleted(event.data.object);
                break;
            default:
                console.log(`Unhandled event type ${event.type}`);
        }
    }

    async handleCheckoutCompleted(session) {
        const { userId, plan } = session.metadata;
        // userId might be null if created outside app, handle safely if needed
        if (!userId) return;

        await prisma.subscription.upsert({
            where: { userId },
            update: {
                plan,
                status: 'Active',
                stripeId: session.customer, // Save Customer ID for Portal
                startDate: new Date(),
                // Simplification: In real app, fetch subscription to get period_end
                endDate: new Date(new Date().setMonth(new Date().getMonth() + 1))
            },
            create: {
                userId,
                plan,
                status: 'Active',
                stripeId: session.customer,
                startDate: new Date(),
                endDate: new Date(new Date().setMonth(new Date().getMonth() + 1))
            }
        });
        console.log(`✅ Subscription Activated for User ${userId}`);
    }

    // Stub implementations for others
    async handleInvoicePaymentSucceeded(invoice) {
        // Extend subscription logic
        console.log(`💰 Invoice paid: ${invoice.id}`);
    }

    async handleSubscriptionDeleted(subscription) {
        // Find user by stripeId or email logic needed if metadata missing
        console.log(`❌ Subscription canceled: ${subscription.id}`);
    }
}

module.exports = new PaymentService();
