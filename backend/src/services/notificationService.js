const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');
const prisma = require('../lib/prisma');
const socketService = require('./socketService');

class NotificationService {
    constructor() {
        // Email Setup
        if (process.env.SENDGRID_API_KEY) {
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            this.emailProvider = sgMail;
        } else {
            const msg = 'SENDGRID_API_KEY is not configured.';
            if (process.env.NODE_ENV === 'production') {
                console.error('🔴 FATAL: NotificationService - ' + msg + ' Email features will not work in production.');
                throw new Error(msg);
            } else {
                console.warn('⚠️ NotificationService:', msg, 'Emails will be logged to console in development.');
            }
        }

        // SMS Setup
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            this.smsProvider = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            this.twilioPhone = process.env.TWILIO_PHONE_NUMBER;
        } else {
            console.warn('⚠️ NotificationService: TWILIO_CREDS missing. SMS will be logged to console.');
        }
    }

    /**
     * Create a system notification and broadcast via Socket.IO
     */
    async createNotification(userId, title, message, type = 'info', link = null) {
        try {
            // Persist to DB
            const notification = await prisma.notification.create({
                data: {
                    userId,
                    title,
                    message,
                    type,
                    link
                }
            });

            // Broadcast Real-time
            socketService.sendToUser(userId, 'notification:new', notification);

            return notification;
        } catch (error) {
            console.error('Failed to create notification:', error);
            // Don't throw, just log. Notification failure shouldn't break the main flow.
        }
    }

    async sendEmail(to, subject, html) {
        if (!to) return;

        if (this.emailProvider) {
            try {
                await this.emailProvider.send({
                    to,
                    from: process.env.EMAIL_FROM || 'noreply@scriptishrx.com',
                    subject,
                    html,
                });
                console.log(`📧 Email sent to ${to}`);
            } catch (error) {
                console.error(`❌ Email Failed (${to}):`, error.message);
                if (error.response && error.response.body) {
                    console.error('   Reason:', JSON.stringify(error.response.body, null, 2));
                }
            }
        } else {
            // In production we should never hit this branch due to constructor check.
            console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject} | Body: ${html.substring(0, 50)}...`);
        }
    }

    async sendSMS(to, body, tenantId = null) {
        if (!to) return;

        try {
            if (tenantId) {
                // Use Tenant-Specific Twilio Service
                const twilioService = require('./twilioService'); // Lazy load
                await twilioService.sendSms(tenantId, to, body);
            } else if (this.smsProvider && this.twilioPhone) {
                // Fallback to Global Env Config
                await this.smsProvider.messages.create({
                    body,
                    from: this.twilioPhone,
                    to
                });
                console.log(`📱 SMS sent to ${to} (Global Provider)`);
            } else {
                const msg = 'Twilio credentials not configured for global SMS sending.';
                if (process.env.NODE_ENV === 'production') {
                    console.error('🔴 FATAL: NotificationService -', msg);
                    throw new Error(msg);
                }
                console.log(`[MOCK SMS] To: ${to} | Body: ${body}`);
            }
        } catch (error) {
            console.error(`❌ SMS Failed (${to}):`, error.message);
            throw error;
        }
    }
}

module.exports = new NotificationService();
