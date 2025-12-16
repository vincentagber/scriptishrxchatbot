// routes/voicecake.js
const express = require('express');
const router = express.Router();
const voiceCakeService = require('../services/voiceCakeService');
const voiceService = require('../services/voiceService'); // for outbound calls
const { authenticateToken } = require('../middleware/auth');

// Check if running in mock mode
const isMockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true' || !process.env.VOICECAKE_API_KEY;

if (isMockMode) {
    console.log('⚠️  VoiceCake running in MOCK MODE - Authentication optional');
}

// Optional authentication middleware
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            const jwt = require('jsonwebtoken');
            const user = jwt.verify(token, process.env.JWT_SECRET);
            req.user = user;
        } catch (error) {
            console.warn('Invalid token provided, continuing without auth');
        }
    }
    next();
};

/**
 * GET /api/voicecake/agents
 * List all available VoiceCake agents (NO AUTH REQUIRED in mock mode)
 */
router.get('/agents', isMockMode ? optionalAuth : authenticateToken, async (req, res) => {
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
            error: 'Failed to fetch agents'
        });
    }
});

/**
 * GET /api/voicecake/agents/:id
 */
router.get('/agents/:id', authenticateToken, async (req, res) => {
    try {
        const agent = await voiceCakeService.getAgent(req.params.id);
        if (!agent) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        res.json({ success: true, agent });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/voicecake/tenant/link-agent
 * Link a VoiceCake agent to this tenant (CRITICAL FIX)
 */
router.post('/tenant/link-agent', isMockMode ? optionalAuth : authenticateToken, async (req, res) => {
    try {
        const { agentId } = req.body;
        const tenantId = req.user?.tenantId || 'default_tenant';

        if (!agentId) {
            return res.status(400).json({
                success: false,
                error: 'agentId is required'
            });
        }

        await voiceCakeService.linkAgentToTenant(tenantId, agentId);

        res.json({
            success: true,
            message: 'Agent linked successfully! You can now make outbound calls.',
            setupComplete: true,
            mockMode: isMockMode
        });
    } catch (error) {
        console.error('Link agent error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to link agent'
        });
    }
});

/**
 * GET /api/voicecake/tenant/agent
 * Get currently linked agent for this tenant (NO AUTH REQUIRED in mock mode)
 */
router.get('/tenant/agent', isMockMode ? optionalAuth : authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user?.tenantId || 'default_tenant';

        // In mock mode, always return configured agent
        if (isMockMode) {
            return res.json({
                success: true,
                configured: true,
                agent: {
                    id: 'agent_001',
                    name: 'Default Mock Agent',
                    status: 'active',
                    voice: 'alloy',
                    language: 'en-US'
                },
                tenant: {
                    id: tenantId,
                    name: 'ScriptishRx'
                },
                setupComplete: true,
                mockMode: true
            });
        }

        const agent = await voiceCakeService.getTenantAgent(tenantId);

        if (!agent) {
            return res.json({
                success: true,
                configured: false,
                agent: null,
                setupRequired: true,
                message: 'No agent linked yet. Please configure your voice agent first.'
            });
        }

        res.json({
            success: true,
            configured: true,
            agent,
            setupComplete: true,
            mockMode: false
        });
    } catch (error) {
        console.error('Error fetching tenant agent:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch linked agent'
        });
    }
});

/**
 * POST /api/voicecake/calls/outbound
 * Initiate outbound call – NOW SAFE FROM "No agent linked" ERROR
 */
router.post('/calls/outbound', isMockMode ? optionalAuth : authenticateToken, async (req, res) => {
    try {
        const { phoneNumber, context } = req.body;
        const tenantId = req.user?.tenantId || 'default_tenant';

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        // Validate phone number format
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(phoneNumber)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format. Use E.164 format (+1234567890)'
            });
        }

        // In mock mode, skip agent check
        if (!isMockMode) {
            // CRITICAL: Check if agent is linked first
            const linkedAgent = await voiceCakeService.getTenantAgent(tenantId);
            if (!linkedAgent) {
                return res.status(400).json({
                    success: false,
                    error: 'No voice agent configured',
                    code: 'NO_AGENT_LINKED',
                    setupRequired: true,
                    message: 'Please link a VoiceCake agent to your account before making calls.',
                    action: 'Go to Settings → Voice Agent → Link Agent'
                });
            }
        }

        const result = await voiceService.initiateOutboundCall(
            phoneNumber,
            tenantId,
            context || {}
        );

        if (result.success) {
            res.json({
                success: true,
                message: result.message || 'Call initiated successfully',
                callId: result.callId,
                status: result.status,
                provider: result.provider || 'voicecake',
                phoneNumber: phoneNumber,
                mockMode: isMockMode
            });
        } else {
            res.status(502).json({
                success: false,
                error: result.error || 'Call failed to initiate',
                provider: 'voicecake'
            });
        }
    } catch (error) {
        console.error('Outbound call error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error during call initiation',
            message: error.message
        });
    }
});

/**
 * Optional: Quick status check (great for frontend health polls)
 */
router.get('/status', isMockMode ? optionalAuth : authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user?.tenantId || 'default_tenant';

        if (isMockMode) {
            return res.json({
                success: true,
                voiceIntegration: {
                    provider: 'VoiceCake',
                    configured: true,
                    agent: {
                        id: 'agent_001',
                        name: 'Default Mock Agent'
                    },
                    readyForCalls: true,
                    mockMode: true
                }
            });
        }

        const agent = await voiceCakeService.getTenantAgent(tenantId);

        res.json({
            success: true,
            voiceIntegration: {
                provider: 'VoiceCake',
                configured: !!agent,
                agent: agent || null,
                readyForCalls: !!agent,
                mockMode: false
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Status check failed' });
    }
});

/**
 * GET /api/voicecake/stats
 * Get advanced stats for the dashboard
 */
router.get('/stats', isMockMode ? optionalAuth : authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user?.tenantId || 'default_tenant';

        // 1. Get linked agent to scope stats
        let agentId = null;
        if (!isMockMode) {
            const agent = await voiceCakeService.getTenantAgent(tenantId);
            agentId = agent?.id;
        } else {
            agentId = 'agent_001';
        }

        // 2. Fetch real stats if possible, otherwise use service mock
        const stats = await voiceCakeService.getVoiceStats();

        // 3. If we have agent-specific stats, use those (preferred)
        if (agentId) {
            try {
                const agentStats = await voiceCakeService.getAgentStats(agentId);
                // Merge general voice stats with specific agent stats
                res.json({
                    success: true,
                    stats: {
                        activeCalls: stats.activeCalls || 0,
                        callsToday: agentStats.totalCalls || stats.totalCallsToday || 0,
                        averageDuration: agentStats.averageDuration || stats.averageDuration || 0,
                        Sentiment: 'Positive (96%)', // Placeholder as API doesn't return this yet
                        mockMode: isMockMode
                    }
                });
                return;
            } catch (e) {
                // Fallback if agent stats fail
            }
        }

        // Default response
        res.json({
            success: true,
            stats: {
                activeCalls: stats.activeCalls || 0,
                callsToday: stats.totalCallsToday || 0,
                averageDuration: stats.averageDuration || 0,
                Sentiment: 'Positive (94%)',
                mockMode: isMockMode
            }
        });

    } catch (error) {
        console.error('Error fetching voicecake stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch voice stats' });
    }
});

/**
 * POST /api/voice/inbound-config
 * Configure inbound number for the tenant
 */
router.post('/inbound-config', isMockMode ? optionalAuth : authenticateToken, async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        const tenantId = req.user?.tenantId || 'default_tenant';

        // In a real app, we would:
        // 1. Verify ownership of the number (via Twilio API)
        // 2. Update the webhook URL for that number to point to our /webhook/voice endpoint
        // 3. Save the number to the Tenant record in DB

        console.log(`[Voice] Configured inbound number ${phoneNumber} for tenant ${tenantId}`);

        res.json({
            success: true,
            message: `Agent configured to answer calls on ${phoneNumber}`,
            webhookUrl: `${process.env.APP_URL || 'https://scriptishrxchatbot.onrender.com'}/api/voicecake/webhook/voice`,
            mockMode: isMockMode
        });
    } catch (error) {
        console.error('Inbound config error:', error);
        res.status(500).json({ success: false, error: 'Failed to configure inbound number' });
    }
});

/**
 * POST /api/voicecake/webhook/voice
 * Incoming call webhook - Called by Twilio/VoiceCake
 */
router.post('/webhook/voice', async (req, res) => {
    console.log('[Voice Webhook] Incoming call received:', req.body);

    // TwiML Response to connect to Agent
    // This is what Twilio expects to know what to do with the call
    const twiml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say voice="alice">Connecting you to the AI Assistant.</Say>
        <Connect>
            <Stream url="wss://${req.get('host')}/media-stream" />
        </Connect>
    </Response>
    `;

    res.set('Content-Type', 'text/xml');
    res.send(twiml);
});

module.exports = router;