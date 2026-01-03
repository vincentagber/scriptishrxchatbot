const Mailjet = require('node-mailjet');
const twilio = require('twilio');
const prisma = require('../lib/prisma');
const socketService = require('./socketService');

// ============================================================
// EMAIL TEMPLATES - Professional HTML Templates
// ============================================================
const EMAIL_TEMPLATES = {
    WELCOME_EMAIL: (data) => ({
        subject: `Welcome to ScriptishRx, ${data.name}! 🎉`,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; border-radius: 16px;">
                <div style="background: white; border-radius: 12px; padding: 40px; text-align: center;">
                    <h1 style="color: #1a1a2e; margin: 0 0 20px;">Welcome aboard! 👋</h1>
                    <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
                        Hi <strong>${data.name}</strong>, we're thrilled to have you join ScriptishRx!
                    </p>
                    <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
                        Your 14-day free trial has started. Explore all our premium features and see how we can help streamline your business.
                    </p>
                    <a href="${data.dashboardUrl || 'https://scriptishrx.net/dashboard'}" style="display: inline-block; margin-top: 20px; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Go to Dashboard →
                    </a>
                    <p style="color: #a0aec0; font-size: 12px; margin-top: 30px;">
                        Need help? Reply to this email or visit our support center.
                    </p>
                </div>
            </div>
        `
    }),

    PAYMENT_CONFIRMATION: (data) => ({
        subject: `Payment Confirmed - ${data.planName} Plan`,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; background: #f7fafc; padding: 40px 20px;">
                <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="width: 60px; height: 60px; background: #48bb78; border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
                            <span style="color: white; font-size: 30px;">✓</span>
                        </div>
                        <h1 style="color: #1a1a2e; margin: 0;">Payment Successful!</h1>
                    </div>
                    <div style="background: #f7fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                        <p style="margin: 8px 0; color: #4a5568;"><strong>Plan:</strong> ${data.planName}</p>
                        <p style="margin: 8px 0; color: #4a5568;"><strong>Amount:</strong> ${data.amount || 'N/A'}</p>
                        <p style="margin: 8px 0; color: #4a5568;"><strong>Reference:</strong> ${data.reference || 'N/A'}</p>
                    </div>
                    <p style="color: #4a5568; text-align: center;">
                        Thank you for upgrading! Your account now has full access to all ${data.planName} features.
                    </p>
                </div>
            </div>
        `
    }),

    BOOKING_CONFIRMATION: (data) => ({
        subject: `Booking Confirmed: ${new Date(data.date).toLocaleDateString()}`,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; background: #f7fafc; padding: 40px 20px;">
                <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <h1 style="color: #1a1a2e; margin: 0 0 20px; text-align: center;">Your Appointment is Confirmed! 📅</h1>
                    <p style="color: #4a5568; text-align: center;">Hi ${data.clientName},</p>
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center;">
                        <p style="color: rgba(255,255,255,0.8); margin: 0 0 8px; font-size: 14px;">SCHEDULED FOR</p>
                        <p style="color: white; margin: 0; font-size: 24px; font-weight: bold;">
                            ${new Date(data.date).toLocaleString()}
                        </p>
                    </div>
                    ${data.purpose ? `<p style="color: #4a5568; text-align: center;"><strong>Purpose:</strong> ${data.purpose}</p>` : ''}
                    ${data.meetingLink ? `
                        <div style="text-align: center; margin-top: 20px;">
                            <a href="${data.meetingLink}" style="display: inline-block; padding: 14px 32px; background: #4285f4; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                🎥 Join Meeting
                            </a>
                            <p style="color: #a0aec0; font-size: 12px; margin-top: 10px;">${data.meetingLink}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `
    }),

    BOOKING_REMINDER: (data) => ({
        subject: `Reminder: Appointment ${data.timeLabel}`,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; background: #fff8e1; padding: 40px 20px;">
                <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <h1 style="color: #1a1a2e; margin: 0 0 20px; text-align: center;">⏰ Appointment Reminder</h1>
                    <p style="color: #4a5568; text-align: center;">Hi ${data.clientName},</p>
                    <p style="color: #4a5568; text-align: center;">
                        This is a friendly reminder about your upcoming appointment <strong>${data.timeLabel}</strong>.
                    </p>
                    <div style="background: #f7fafc; border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center;">
                        <p style="color: #667eea; margin: 0; font-size: 20px; font-weight: bold;">
                            ${new Date(data.date).toLocaleString()}
                        </p>
                    </div>
                    ${data.meetingLink ? `
                        <div style="text-align: center;">
                            <a href="${data.meetingLink}" style="display: inline-block; padding: 14px 32px; background: #4285f4; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                Join Meeting
                            </a>
                        </div>
                    ` : ''}
                </div>
            </div>
        `
    }),

    TRIAL_EXPIRY_WARNING: (data) => ({
        subject: `⚠️ Your trial expires in ${data.daysLeft} days`,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%); padding: 40px 20px; border-radius: 16px;">
                <div style="background: white; border-radius: 12px; padding: 40px; text-align: center;">
                    <h1 style="color: #1a1a2e; margin: 0 0 20px;">Your Trial is Almost Over!</h1>
                    <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
                        Hi ${data.name}, your free trial expires in <strong>${data.daysLeft} days</strong>.
                    </p>
                    <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
                        Don't lose access to these amazing features:
                    </p>
                    <ul style="text-align: left; color: #4a5568; padding-left: 20px;">
                        <li>📞 AI Voice Agent</li>
                        <li>📅 Google Calendar Sync</li>
                        <li>📧 Automated Email Notifications</li>
                        <li>📊 Advanced Analytics</li>
                    </ul>
                    <a href="${data.upgradeUrl || 'https://scriptishrx.net/dashboard/settings?tab=billing'}" style="display: inline-block; margin-top: 20px; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Upgrade Now →
                    </a>
                </div>
            </div>
        `
    })
};

// ============================================================
// NOTIFICATION SERVICE CLASS
// ============================================================
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
                console.error('🔴 FATAL: NotificationService - ' + msg);
            } else {
                console.warn('⚠️ NotificationService:', msg, 'Emails will be mocked.');
            }
        }

        // SMS Setup
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            this.smsProvider = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            this.twilioPhone = process.env.TWILIO_PHONE_NUMBER;
        } else {
            console.warn('⚠️ NotificationService: Twilio not configured.');
        }
    }

    /**
     * Create in-app notification and broadcast via Socket.IO
     */
    async createNotification(userId, title, message, type = 'info', link = null) {
        try {
            const notification = await prisma.notification.create({
                data: { userId, title, message, type, link }
            });
            socketService.sendToUser(userId, 'notification:new', notification);
            return notification;
        } catch (error) {
            console.error('[NotificationService] Failed to create notification:', error.message);
        }
    }

    /**
     * Send templated email (recommended method)
     */
    async sendTemplatedEmail(to, templateType, data) {
        if (!to) return;

        const template = EMAIL_TEMPLATES[templateType];
        if (!template) {
            console.error(`[NotificationService] Unknown template: ${templateType}`);
            return;
        }

        const { subject, html } = template(data);
        return this.sendEmail(to, subject, html);
    }

    /**
     * Send raw email via Mailjet
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
                        Messages: [{
                            From: { Email: senderEmail, Name: senderName },
                            To: [{ Email: to }],
                            Subject: subject,
                            HTMLPart: html
                        }]
                    });
                console.log(`📧 Email sent to ${to} | Subject: ${subject}`);
                return result;
            } catch (error) {
                console.error(`❌ [Mailjet] Email failed (${to}):`, error.message);
                if (error.response?.data) {
                    console.error('   Details:', JSON.stringify(error.response.data, null, 2));
                }
            }
        } else {
            console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject}`);
        }
    }

    /**
     * Send SMS via Twilio
     */
    async sendSMS(to, body, tenantId = null) {
        if (!to) return;

        try {
            if (tenantId) {
                const twilioService = require('./twilioService');
                await twilioService.sendSms(tenantId, to, body);
            } else if (this.smsProvider && this.twilioPhone) {
                await this.smsProvider.messages.create({
                    body,
                    from: this.twilioPhone,
                    to
                });
                console.log(`📱 SMS sent to ${to}`);
            } else {
                console.log(`[MOCK SMS] To: ${to} | Body: ${body}`);
            }
        } catch (error) {
            console.error(`❌ SMS Failed (${to}):`, error.message);
        }
    }
}

module.exports = new NotificationService();
