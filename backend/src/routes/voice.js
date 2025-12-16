// backend/src/routes/voice.js
const express = require('express');
const router = express.Router();
const voiceService = require('../services/voiceService');
const voiceCakeService = require('../services/voiceCakeService');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission, verifyTenantAccess } = require('../middleware/permissions');
const { checkSubscriptionAccess, checkFeature } = require('../middleware/subscription');

// Check if running in mock mode
const isMockMode = voiceCakeService.isMockMode();

if (isMockMode) {
    console.log('⚠️  Voice routes running in MOCK MODE');
}

/**
 * GET /api/voice/health - Health check endpoint (public)
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'voice',
        status: 'operational',
        mockMode: isMockMode,
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
                total: logs.length,
                mockMode: isMockMode
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
    authenticateToken,
    verifyTenantAccess,
    checkSubscriptionAccess,
    checkFeature('voice_agent'),
    checkPermission('voice_agents', 'configure'),
    async (req, res) => {
        try {
            // Accept both 'to' and 'phoneNumber' parameters
            const phoneNumber = req.body.to || req.body.phoneNumber;
            const { agentId, campaign, context, customData } = req.body;

            // Validate phone number
            if (!phoneNumber || typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number is required'
                });
            }

            const cleanPhone = phoneNumber.trim();

            // Validate phone format
            const phoneRegex = /^\+?[1-9]\d{1,14}$/;
            const cleanedForValidation = cleanPhone.replace(/[\s()-]/g, '');

            if (!phoneRegex.test(cleanedForValidation)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid phone number format. Use international format (e.g., +1234567890)'
                });
            }

            const tenantId = req.scopedTenantId;

            console.log(`[Voice] Initiating outbound call to ${cleanPhone} for tenant ${tenantId}...`);

            // Call voice service
            const result = await voiceService.initiateOutboundCall(
                cleanPhone,
                tenantId,
                {
                    agentId,
                    campaign,
                    context,
                    ...customData
                }
            );

            if (result.success) {
                res.json({
                    success: true,
                    message: result.message || 'Call initiated successfully',
                    callId: result.callId,
                    status: result.status,
                    phoneNumber: cleanPhone,
                    mockMode: isMockMode
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error || 'Failed to initiate call',
                    message: result.message
                });
            }
        } catch (error) {
            console.error('Error initiating outbound call:', error);

            res.status(500).json({
                success: false,
                error: 'Internal server error during call initiation',
                message: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
);

/**
 * GET /api/voice/status/:callId - Get call status
 */
router.get('/status/:callId',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('voice_agents', 'read'),
    async (req, res) => {
        try {
            const { callId } = req.params;

            // Get status from voice service
            const status = voiceService.getCallStatus(callId);

            if (status) {
                res.json({
                    success: true,
                    ...status
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Call not found',
                    callId
                });
            }
        } catch (error) {
            console.error('Error fetching call status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch call status',
                message: error.message
            });
        }
    }
);

/**
 * GET /api/voice/agents - Get available voice agents
 */
router.get('/agents',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('voice_agents', 'read'),
    async (req, res) => {
        try {
            const agents = await voiceCakeService.getAllAgents();

            res.json({
                success: true,
                agents,
                mockMode: isMockMode
            });
        } catch (error) {
            console.error('Error fetching agents:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch agents',
                message: error.message
            });
        }
    }
);

/**
 * GET /api/voice/phone-numbers - Get available phone numbers
 */
router.get('/phone-numbers',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('voice_agents', 'read'),
    async (req, res) => {
        try {
            const phoneNumbers = await voiceCakeService.getPhoneNumbers();

            res.json({
                success: true,
                phoneNumbers,
                mockMode: isMockMode
            });
        } catch (error) {
            console.error('Error fetching phone numbers:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch phone numbers',
                message: error.message
            });
        }
    }
);

/**
 * GET /api/voice/stats - Get voice statistics
 */
router.get('/stats',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('voice_agents', 'read'),
    async (req, res) => {
        try {
            const stats = await voiceCakeService.getVoiceStats();

            res.json({
                success: true,
                stats,
                mockMode: isMockMode
            });
        } catch (error) {
            console.error('Error fetching voice stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch voice statistics',
                message: error.message
            });
        }
    }
);

module.exports = router;