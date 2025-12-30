const axios = require('axios');
const prisma = require('../lib/prisma');
const notificationService = require('./notificationService');
const AppError = require('../utils/AppError');

class PaymentService {
    constructor() {
        if (process.env.PAYSTACK_SECRET_KEY) {
            this.paystack = axios.create({
                baseURL: 'https://api.paystack.co',
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
        } else {
            console.warn('⚠️ Paystack Secret Key Missing. Payment features will be disabled.');
        }
    }

    // Initialize Transaction
    async initiateTransaction(userId, plan, cycle = 'monthly') {
        if (!this.paystack) throw new AppError('Payment processing unavailable.', 503);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { tenant: true }
        });

        if (!user) throw new AppError('User not found', 404);

        // Plan Logic
        const priceMap = {
            'Basic': { amount: 2900, planCode: process.env.PAYSTACK_PLAN_BASIC },
            'Intermediate': { amount: 7900, planCode: process.env.PAYSTACK_PLAN_INTERMEDIATE },
            'Advanced': { amount: 19900, planCode: process.env.PAYSTACK_PLAN_ADVANCED }
        };

        const planConfig = priceMap[plan];
        if (!planConfig) throw new AppError('Invalid plan selected', 400);

        try {
            // Call Paystack API
            const payload = {
                email: user.email,
                amount: planConfig.amount * 100, // kobo
                currency: 'NGN',
                metadata: {
                    userId: user.id,
                    tenantId: user.tenantId,
                    plan,
                    cycle
                },
                callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/settings/subscription?status=success`,
                channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer']
            };

            const response = await this.paystack.post('/transaction/initialize', payload);
            const { authorization_url, access_code, reference } = response.data.data;

            // PERSIST TRANSACTION TO DB
            await prisma.transaction.create({
                data: {
                    userId: user.id,
                    reference: reference,
                    amount: planConfig.amount * 100,
                    currency: 'NGN',
                    status: 'INITIATED',
                    plan: plan,
                    metadata: payload
                }
            });

            console.log(`✅ Transaction Initiated: ${reference}`);
            return { url: authorization_url, reference };
        } catch (error) {
            console.error('Paystack Init Error:', error.response?.data || error.message);
            throw new AppError('Failed to initiate payment', 502);
        }
    }

    // Verify Transaction via Webhook or Manual
    async verifyTransaction(reference) {
        if (!this.paystack) return false;

        // SIMULATION MODE (Dev/Audit only)
        if (reference.startsWith('sim_') && process.env.NODE_ENV !== 'production') {
            console.log(`⚠️ Simulation Verify: ${reference}`);
            const existingTx = await prisma.transaction.findUnique({
                where: { reference },
                include: { user: true }
            });

            if (existingTx) {
                await this._handleSuccessResponse(existingTx, reference, {
                    userId: existingTx.userId,
                    tenantId: existingTx.metadata?.tenantId,
                    plan: existingTx.plan
                }, existingTx.amount);
                return true;
            }
            return false;
        }

        try {
            // 1. Check DB first to avoid duplicate work if already successful
            const existingTx = await prisma.transaction.findUnique({
                where: { reference },
                include: { user: true }
            });

            if (existingTx && existingTx.status === 'SUCCESS') {
                return true;
            }

            // 2. Verify with Paystack
            const response = await this.paystack.get(`/transaction/verify/${reference}`);
            const { status, amount, metadata } = response.data.data;

            if (status === 'success') {
                await this._handleSuccessResponse(existingTx, reference, metadata, amount);
                return true;
            } else {
                await prisma.transaction.update({
                    where: { reference },
                    data: {
                        status: 'FAILED',
                        errorMessage: response.data.data.gateway_response || 'Payment Failed'
                    }
                });
                if (existingTx && existingTx.user) {
                    this.sendFailureEmail(existingTx.user, metadata?.plan, 'Payment Declined');
                }
                return false;
            }

        } catch (error) {
            console.error('Verification Error:', error.message);
            return false;
        }
    }

    async _handleSuccessResponse(existingTx, reference, metadata, amount) {
        await prisma.$transaction(async (tx) => {
            // Update Transaction
            // We use upsert on Transaction just in case it didn't exist (webhook came before local db create finished? unlikely but safe)
            // Actually assuming it exists or we update it.
            if (existingTx) {
                await tx.transaction.update({
                    where: { reference },
                    data: {
                        status: 'SUCCESS',
                        paidAt: new Date(),
                        metadata: metadata
                    }
                });
            }

            // Update Subscription
            const plan = metadata?.plan || 'Basic';
            if (metadata && metadata.userId) {
                await tx.subscription.upsert({
                    where: { userId: metadata.userId },
                    create: {
                        userId: metadata.userId,
                        plan: plan,
                        status: 'active',
                        stripeId: `paystack_${reference}`,
                        startDate: new Date()
                    },
                    update: {
                        plan: plan,
                        status: 'active',
                        updatedAt: new Date()
                    }
                });

                // Update Tenant (Access Control)
                if (metadata.tenantId) {
                    await tx.tenant.update({
                        where: { id: metadata.tenantId },
                        data: { plan: plan }
                    });
                }
            }
        });

        console.log(`✅ Payment Verified: ${reference}`);

        // 1. Notify the Subscriber (Success)
        if (existingTx && existingTx.user) {
            await this.sendSuccessEmail(existingTx.user, amount / 100, reference, metadata?.plan);
        }

        // 2. Notify SUPER_ADMINs (New Subscription Event)
        try {
            const superAdmins = await prisma.user.findMany({
                where: { role: 'SUPER_ADMIN' },
                select: { email: true }
            });

            const subscriptionType = metadata?.type || 'INDIVIDUAL';
            const subscriberName = existingTx?.user?.name || existingTx?.user?.email || 'Unknown User';

            for (const admin of superAdmins) {
                await notificationService.sendEmail(
                    admin.email,
                    `🔔 New Subscription Alert: ${subscriberName}`,
                    `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd;">
                        <h2>New Subscriber Joined</h2>
                        <p><strong>Type:</strong> ${subscriptionType}</p>
                        <p><strong>Subscriber:</strong> ${subscriberName} (${existingTx?.user?.email})</p>
                        <p><strong>Plan:</strong> ${metadata?.plan}</p>
                        <p><strong>Amount:</strong> NGN ${amount / 100}</p>
                        <p><strong>Reference:</strong> ${reference}</p>
                        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
                        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/admin">View in Dashboard</a>
                     </div>`
                );
            }
            console.log(`📧 Superadmin Alerts Sent: ${superAdmins.length}`);
        } catch (emailErr) {
            console.error('Failed to alert superadmins:', emailErr);
        }
    }

    async sendSuccessEmail(user, amount, reference, plan) {
        const subject = `Payment Successful - ${plan} Plan`;
        const body = `
            <div style="font-family: sans-serif; padding: 20px;">
                <h2>Payment Confirmed!</h2>
                <p>Hi ${user.name || 'there'},</p>
                <p>We successfully received your payment of <strong>NGN ${amount}</strong> for the <strong>${plan}</strong> plan.</p>
                <p><strong>Reference:</strong> ${reference}</p>
                <p>Your subscription is now active.</p>
            </div>
        `;
        await notificationService.sendEmail(user.email, subject, body);
    }

    async sendFailureEmail(user, plan, reason) {
        const subject = `Payment Failed for ${plan}`;
        await notificationService.sendEmail(user.email, subject, `Payment failed. Reason: ${reason}`);
    }

    async createPortalSession(userId) {
        return { url: 'https://dashboard.paystack.com/#/subscriptions' };
    }
}

module.exports = new PaymentService();
