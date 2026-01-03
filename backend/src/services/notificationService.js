const Mailjet = require('node-mailjet');
const twilio = require('twilio');
const prisma = require('../lib/prisma');
const socketService = require('./socketService');

class NotificationService {
    constructor() {
        // Email Setup - Mailjet
        if (process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET_KEY) {
            this.mailjet = Mailjet.apiConnect(
                process.env.MAILJET_API_KEY,
                process.env.MAILJET_SECRET_KEY
            );
            console.log('✅ Mailjet email provider configured');
        } else {
            const msg = 'MAILJET_API_KEY or MAILJET_SECRET_KEY is not configured.';
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

    /**
     * Send email using Mailjet
     */
    async sendEmail(to, subject, html) {
        if (!to) return;

        const senderEmail = process.env.EMAIL_FROM || 'noreply@scriptishrx.com';
        const senderName = process.env.EMAIL_FROM_NAME || 'ScriptishRx';

        if (this.mailjet) {
            try {
                const result = await this.mailjet
                    .post('send', { version: 'v3.1' })
                    .request({
                        Messages: [
                            {
                                From: {
                                    Email: senderEmail,
                                    Name: senderName
                                },
                                To: [
                                    {
                                        Email: to
                                    }
                                ],
                                Subject: subject,
                                HTMLPart: html
                            }
                        ]
                    });

                console.log(`📧 Email sent to ${to} via Mailjet`);
                return result;
            } catch (error) {
                console.error(`❌ Mailjet Email Failed (${to}):`, error.message);
                if (error.response) {
                    console.error('   Response:', JSON.stringify(error.response.data || error.response.body, null, 2));
                }
            }
        } else {
            // Mock in development if not configured
            console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject} | Body: ${html.substring(0, 100)}...`);
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
