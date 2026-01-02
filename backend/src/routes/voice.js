// backend/src/routes/voice.js
const express = require('express');
const router = express.Router();
const voiceService = require('../services/voiceService');
const prisma = require('../lib/prisma'); // Access DB directly for resource helpers
const { authenticateToken } = require('../middleware/auth');
const { checkPermission, verifyTenantAccess } = require('../middleware/permissions');
const { checkSubscriptionAccess, checkFeature } = require('../middleware/subscription');
const { voiceLimiter } = require('../middleware/rateLimiting');
const { checkFeature: checkGlobalFeature } = require('../config/features');

// GLOBAL LOCK
router.use(checkGlobalFeature('VOICE_AGENTS'));

/**
 * 4️⃣ HARD BLOCK browser access to voice routes
 */
router.all('/stream', (req, res) => {
    res.status(426).send('Upgrade Required: Use WebSocket connection');
});


/**
 * GET /api/voice/health - Health check endpoint (public)
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'voice',
        provider: 'twilio',
        status: 'operational',
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /api/voice/logs - Get voice call logs
 */
router.get('/logs',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('voice_agents', 'read'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const logs = voiceService.getCallLogs(tenantId);

            res.json({
                success: true,
                logs: logs,
                total: logs.length
            });
        } catch (error) {
            console.error('Error fetching voice logs:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch logs',
                message: error.message
            });
        }
    }
);

/**
 * POST /api/voice/outbound - Initiate outbound call
 */
router.post('/outbound',
    voiceLimiter,
    authenticateToken,
    verifyTenantAccess,
    checkSubscriptionAccess,
    checkFeature('voice_agent'),
    checkPermission('voice_agents', 'configure'),
    async (req, res) => {
        try {
            const phoneNumber = req.body.to || req.body.phoneNumber;
            const { customData } = req.body;

            if (!phoneNumber) {
                return res.status(400).json({ success: false, error: 'Phone number is required' });
            }

            const tenantId = req.scopedTenantId;

            // Clean phone number
            const cleanPhone = phoneNumber.replace(/[\s()-]/g, '');

            console.log(`[Voice] Initiating Twilio call to ${cleanPhone} for tenant ${tenantId}...`);

            const result = await voiceService.initiateOutboundCall(
                cleanPhone,
                tenantId,
                customData || {}
            );

            if (result.success) {
                res.json({
                    success: true,
                    message: result.message,
                    callId: result.callId,
                    status: result.status,
                    provider: 'twilio' // Explicitly state provider
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error,
                    message: result.message
                });
            }
        } catch (error) {
            console.error('Error initiating outbound call:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        }
    }
);

/**
 * GET /api/voice/status/:callId
 */
router.get('/status/:callId',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('voice_agents', 'read'),
    async (req, res) => {
        const { callId } = req.params;
        const tenantId = req.scopedTenantId;

        const status = voiceService.getCallStatus(callId, tenantId);

        if (status) {
            res.json({ success: true, ...status });
        } else {
            res.status(404).json({ success: false, error: 'Call not found' });
        }
    }
);

/**
 * GET /api/voice/agents - Get AI Configuration (replaces "Agents")
 */
router.get('/agents',
    authenticateToken,
    verifyTenantAccess,
    async (req, res) => {
        // Return the Tenant's AI Config as the "Agent"
        try {
            const tenant = await prisma.tenant.findUnique({
                where: { id: req.scopedTenantId },
                select: { aiConfig: true, id: true }
            });

            const aiConfig = tenant.aiConfig || {};

            // Construct a virtual agent based on config
            const virtualAgent = {
                id: `ai_${tenant.id}`,
                name: aiConfig.aiName || 'Twilio AI Assistant',
                status: 'active',
                type: 'artificial_intelligence',
                model: aiConfig.model || 'gpt-4'
            };

            res.json({
                success: true,
                agents: [virtualAgent]
            });
        } catch (e) {
            res.status(500).json({ success: false, error: 'Failed to fetch agent info' });
        }
    }
);

/**
 * GET /api/voice/phone-numbers - Get Tenant's Twilio Number
 */
router.get('/phone-numbers',
    authenticateToken,
    verifyTenantAccess,
    async (req, res) => {
        try {
            const tenant = await prisma.tenant.findUnique({
                where: { id: req.scopedTenantId },
                select: { twilioConfig: true, phoneNumber: true }
            });

            const config = tenant.twilioConfig || {};
            // Prefer config phoneNumber, fallback to tenant.phoneNumber
            const number = config.phoneNumber || tenant.phoneNumber;

            res.json({
                success: true,
                phoneNumbers: number ? [{ phoneNumber: number, friendlyName: 'Business Line' }] : []
            });
        } catch (e) {
            res.status(500).json({ success: false, error: 'Failed to fetch phone numbers' });
        }
    }
);

/**
 * GET /api/voice/calls - Get call sessions for tenant
 */
router.get('/calls',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('voice_agents', 'read'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { limit = 50, includeTranscript = false } = req.query;

            const sessions = await voiceService.getCallSessions(tenantId, {
                limit: parseInt(limit),
                includeTranscript: includeTranscript === 'true'
            });

            res.json({
                success: true,
                calls: sessions,
                total: sessions.length
            });
        } catch (error) {
            console.error('Error fetching call sessions:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch call sessions'
            });
        }
    }
);

/**
 * GET /api/voice/calls/:id - Get single call session with full details
 */
router.get('/calls/:id',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('voice_agents', 'read'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { id } = req.params;

            const session = await voiceService.getCallSession(id, tenantId);

            if (!session) {
                return res.status(404).json({
                    success: false,
                    error: 'Call session not found'
                });
            }

            res.json({
                success: true,
                call: session
            });
        } catch (error) {
            console.error('Error fetching call session:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch call session'
            });
        }
    }
);

/**
 * GET /api/voice/calls/:id/summary - Get AI-generated summary for a call
 */
router.get('/calls/:id/summary',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('voice_agents', 'read'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { id } = req.params;

            const session = await prisma.callSession.findFirst({
                where: { id, tenantId },
                select: {
                    id: true,
                    summary: true,
                    actionItems: true,
                    transcript: true,
                    duration: true,
                    startedAt: true,
                    client: { select: { name: true } }
                }
            });

            if (!session) {
                return res.status(404).json({
                    success: false,
                    error: 'Call session not found'
                });
            }

            res.json({
                success: true,
                callId: session.id,
                summary: session.summary,
                actionItems: session.actionItems,
                hasTranscript: !!session.transcript,
                duration: session.duration,
                date: session.startedAt,
                client: session.client?.name
            });
        } catch (error) {
            console.error('Error fetching call summary:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch call summary'
            });
        }
    }
);

/**
 * POST /api/voice/calls/:id/summarize - Regenerate summary for a call
 */
router.post('/calls/:id/summarize',
    authenticateToken,
    verifyTenantAccess,
    checkSubscriptionAccess,
    checkPermission('voice_agents', 'configure'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { id } = req.params;

            const result = await voiceService.regenerateSummary(id, tenantId);

            res.json({
                success: true,
                message: 'Summary regenerated successfully',
                summary: result.summary
            });
        } catch (error) {
            console.error('Error regenerating summary:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to regenerate summary'
            });
        }
    }
);

/**
 * POST /api/voice/calls/:id/meeting-minute - Create meeting minute from call
 */
router.post('/calls/:id/meeting-minute',
    authenticateToken,
    verifyTenantAccess,
    checkSubscriptionAccess,
    checkPermission('meeting_minutes', 'create'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { id } = req.params;

            // Verify call belongs to tenant
            const session = await prisma.callSession.findFirst({
                where: { id, tenantId },
                include: { client: true }
            });

            if (!session) {
                return res.status(404).json({
                    success: false,
                    error: 'Call session not found'
                });
            }

            if (!session.clientId) {
                return res.status(400).json({
                    success: false,
                    error: 'Call has no associated client. Please link a client first.'
                });
            }

            // Generate and save meeting minute
            const summarizeService = require('../services/summarizeService');
            const minuteData = await summarizeService.processCompletedCall(id, {
                createMeetingMinute: true
            });

            res.status(201).json({
                success: true,
                message: 'Meeting minute created from call',
                minute: {
                    content: minuteData.content,
                    clientId: session.clientId,
                    callId: id
                }
            });
        } catch (error) {
            console.error('Error creating meeting minute from call:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to create meeting minute'
            });
        }
    }
);

module.exports = router;