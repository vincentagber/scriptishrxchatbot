// backend/services/voicecake.service.js
const axios = require('axios');

const VOICECAKE_API_URL = (process.env.VOICECAKE_API_URL || 'https://api.voicecake.io').replace(/\/$/, '');
const VOICECAKE_API_KEY = process.env.VOICECAKE_API_KEY;
const MOCK_MODE = process.env.MOCK_EXTERNAL_SERVICES === 'true';
const hasVoiceCakeKey = !!VOICECAKE_API_KEY;
const isMockMode = MOCK_MODE || !hasVoiceCakeKey;

// In-memory storage for mock mode
const mockAgentLinks = new Map();
const mockCalls = new Map();

// Fail fast in production if key is missing and mock mode not explicitly enabled
if (process.env.NODE_ENV === 'production' && !MOCK_MODE && !hasVoiceCakeKey) {
    console.error('🔴 FATAL: VOICECAKE_API_KEY is not set and MOCK_EXTERNAL_SERVICES is not enabled.');
    throw new Error('VOICECAKE_API_KEY missing in production');
}

// Initialize default agent in mock mode (only when mock explicitly enabled or in dev without key)
if (isMockMode) {
    mockAgentLinks.set('default_tenant', {
        agentId: 'agent_001',
        agentName: 'Twilio Voice Agent (Mock)',
        linkedAt: new Date().toISOString()
    });
    console.log('⚠️  VoiceCake Service running in MOCK MODE');
}

/**
 * Create axios instance with default config
 */
const voiceCakeClient = axios.create({
    baseURL: `${VOICECAKE_API_URL}/api/v1`,
    headers: {
        'Authorization': `Bearer ${VOICECAKE_API_KEY}`,
        'Content-Type': 'application/json',
    },
    timeout: 30000,
});

// ============================================================================
// AGENTS API
// ============================================================================

/**
 * GET /api/v1/agents - Get all agents for the authenticated user
 */
async function getAllAgents() {
    if (isMockMode) {
        return [
            {
                id: 'agent_001',
                name: 'Twilio Sales Bot (Mock)',
                status: 'active',
                language: 'en-US',
                voice: 'alloy',
                description: 'Handles sales inquiries and outbound calls',
                phoneNumber: '+15551234567',
                capabilities: ['inbound', 'outbound'],
                createdAt: new Date().toISOString()
            },
            {
                id: 'agent_002',
                name: 'Twilio Receiver (Mock)',
                status: 'active',
                language: 'en-US',
                voice: 'nova',
                description: 'Inbound reception and call routing',
                phoneNumber: '+15551234568',
                capabilities: ['inbound'],
                createdAt: new Date().toISOString()
            },
            {
                id: 'agent_003',
                name: 'Appointment Agent',
                status: 'active',
                language: 'en-US',
                voice: 'shimmer',
                description: 'Schedules and manages appointments',
                phoneNumber: '+15551234569',
                createdAt: new Date().toISOString()
            }
        ];
    }

    try {
        const response = await voiceCakeClient.get('/agents');
        return response.data.agents || response.data;
    } catch (error) {
        console.error('Error fetching agents:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * GET /api/v1/agents/{agent_id} - Get a specific agent by ID
 */
async function getAgent(agentId) {
    if (isMockMode) {
        const agents = await getAllAgents();
        return agents.find(a => a.id === agentId) || null;
    }

    try {
        const response = await voiceCakeClient.get(`/agents/${agentId}`);
        return response.data.agent || response.data;
    } catch (error) {
        if (error.response?.status === 404) return null;
        console.error(`Error fetching agent ${agentId}:`, error.response?.data || error.message);
        throw error;
    }
}

/**
 * DELETE /api/v1/agents/{agent_id} - Delete a specific agent by ID
 */
async function deleteAgent(agentId) {
    if (isMockMode) {
        console.log(`✓ Mock: Deleted agent ${agentId}`);
        return { success: true, message: 'Agent deleted (mock)' };
    }

    try {
        const response = await voiceCakeClient.delete(`/agents/${agentId}`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting agent ${agentId}:`, error.response?.data || error.message);
        throw error;
    }
}

/**
 * GET /api/v1/agents/{agent_id}/tools - Get tools associated with a specific agent
 */
async function getAgentTools(agentId) {
    if (isMockMode) {
        return [
            {
                id: 'tool_001',
                name: 'Calendar Integration',
                type: 'calendar',
                enabled: true
            },
            {
                id: 'tool_002',
                name: 'CRM Lookup',
                type: 'crm',
                enabled: true
            }
        ];
    }

    try {
        const response = await voiceCakeClient.get(`/agents/${agentId}/tools`);
        return response.data.tools || response.data;
    } catch (error) {
        console.error(`Error fetching tools for agent ${agentId}:`, error.response?.data || error.message);
        throw error;
    }
}

/**
 * GET /api/v1/agents/{agent_id}/stats - Get statistics for a specific agent
 */
async function getAgentStats(agentId) {
    if (isMockMode) {
        return {
            agentId,
            totalCalls: 127,
            successfulCalls: 115,
            failedCalls: 12,
            averageDuration: 134, // seconds
            lastCallAt: new Date().toISOString()
        };
    }

    try {
        const response = await voiceCakeClient.get(`/agents/${agentId}/stats`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching stats for agent ${agentId}:`, error.response?.data || error.message);
        throw error;
    }
}

/**
 * GET /api/v1/agents/phone-number/check/{phone_number} - Check if phone number is available
 */
async function checkPhoneNumberAvailability(phoneNumber) {
    if (isMockMode) {
        return {
            phoneNumber,
            available: true,
            message: 'Phone number is available (mock)'
        };
    }

    try {
        const response = await voiceCakeClient.get(`/agents/phone-number/check/${encodeURIComponent(phoneNumber)}`);
        return response.data;
    } catch (error) {
        console.error(`Error checking phone number ${phoneNumber}:`, error.response?.data || error.message);
        throw error;
    }
}

// ============================================================================
// VOICE API
// ============================================================================

/**
 * POST /api/v1/voice/call - Make an outbound call using Twilio
 */
async function initiateOutboundCall(phoneNumber, agentId, customData = {}) {
    if (isMockMode) {
        const callId = `mock_call_${Date.now()}`;
        const callSid = `CA${Math.random().toString(36).substring(2, 15)}`;

        const mockCall = {
            success: true,
            callId: callId,
            callSid: callSid,
            status: 'initiated',
            phoneNumber: phoneNumber,
            agentId: agentId,
            estimatedWaitTime: 5,
            createdAt: new Date().toISOString(),
            mockMode: true
        };

        mockCalls.set(callSid, mockCall);

        console.log(`✓ Mock: Initiated call to ${phoneNumber} with agent ${agentId}`);
        return mockCall;
    }

    try {
        const response = await voiceCakeClient.post('/voice/call', {
            phoneNumber,
            agentId,
            customData
        });

        return {
            success: true,
            callId: response.data.callId,
            callSid: response.data.callSid,
            status: response.data.status,
            phoneNumber: response.data.phoneNumber
        };
    } catch (error) {
        console.error('Error initiating outbound call:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * GET /api/v1/voice/call/{call_sid} - Get the status of a call
 */
async function getCallStatus(callSid) {
    if (isMockMode) {
        const mockCall = mockCalls.get(callSid);
        if (mockCall) {
            return {
                callSid,
                status: 'completed',
                duration: 125,
                startTime: mockCall.createdAt,
                endTime: new Date().toISOString()
            };
        }
        return {
            callSid,
            status: 'not-found',
            message: 'Call not found (mock)'
        };
    }

    try {
        const response = await voiceCakeClient.get(`/voice/call/${callSid}`);
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            return { callSid, status: 'not-found' };
        }
        console.error(`Error fetching call status ${callSid}:`, error.response?.data || error.message);
        throw error;
    }
}

/**
 * DELETE /api/v1/voice/call/{call_sid} - Hang up a call
 */
async function hangupCall(callSid) {
    if (isMockMode) {
        mockCalls.delete(callSid);
        console.log(`✓ Mock: Hung up call ${callSid}`);
        return { success: true, message: 'Call hung up (mock)' };
    }

    try {
        const response = await voiceCakeClient.delete(`/voice/call/${callSid}`);
        return response.data;
    } catch (error) {
        console.error(`Error hanging up call ${callSid}:`, error.response?.data || error.message);
        throw error;
    }
}

/**
 * GET /api/v1/voice/phone-numbers - Get list of phone numbers in the Twilio account
 */
async function getPhoneNumbers() {
    if (isMockMode) {
        return [
            {
                sid: 'PN001',
                phoneNumber: '+15551234567',
                friendlyName: 'Main Office',
                capabilities: { voice: true, sms: true },
                status: 'active'
            },
            {
                sid: 'PN002',
                phoneNumber: '+15551234568',
                friendlyName: 'Support Line',
                capabilities: { voice: true, sms: true },
                status: 'active'
            }
        ];
    }

    try {
        const response = await voiceCakeClient.get('/voice/phone-numbers');
        return response.data.phoneNumbers || response.data;
    } catch (error) {
        console.error('Error fetching phone numbers:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * POST /api/v1/voice/phone-numbers/{phone_number_sid}/webhook - Update webhook URL for a phone number
 */
async function updatePhoneNumberWebhook(phoneNumberSid, webhookUrl) {
    if (isMockMode) {
        console.log(`✓ Mock: Updated webhook for ${phoneNumberSid} to ${webhookUrl}`);
        return {
            success: true,
            phoneNumberSid,
            webhookUrl,
            message: 'Webhook updated (mock)'
        };
    }

    try {
        const response = await voiceCakeClient.post(`/voice/phone-numbers/${phoneNumberSid}/webhook`, {
            webhookUrl
        });
        return response.data;
    } catch (error) {
        console.error(`Error updating webhook for ${phoneNumberSid}:`, error.response?.data || error.message);
        throw error;
    }
}

/**
 * GET /api/v1/voice/stats - Get statistics for all active calls
 */
async function getVoiceStats() {
    if (isMockMode) {
        return {
            activeCalls: mockCalls.size,
            totalCallsToday: 47,
            averageDuration: 142,
            successRate: 94.5,
            timestamp: new Date().toISOString()
        };
    }

    try {
        const response = await voiceCakeClient.get('/voice/stats');
        return response.data;
    } catch (error) {
        console.error('Error fetching voice stats:', error.response?.data || error.message);
        throw error;
    }
}

// ============================================================================
// TENANT API (Original functions)
// ============================================================================

/**
 * Link an agent to a tenant
 */
async function linkAgentToTenant(tenantId, agentId) {
    if (isMockMode) {
        mockAgentLinks.set(tenantId, {
            agentId: agentId,
            agentName: 'Mock Agent',
            linkedAt: new Date().toISOString()
        });

        console.log(`✓ Mock: Linked agent ${agentId} to tenant ${tenantId}`);
        return {
            success: true,
            tenantId,
            agentId
        };
    }

    try {
        const response = await voiceCakeClient.post('/tenant/link-agent', {
            tenantId,
            agentId
        });

        console.log(`✓ Linked agent ${agentId} to tenant ${tenantId}`);
        return response.data;
    } catch (error) {
        console.error('Error linking agent to tenant:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Get the linked agent for a tenant
 */
async function getTenantAgent(tenantId) {
    if (isMockMode) {
        const link = mockAgentLinks.get(tenantId) || mockAgentLinks.get('default_tenant');

        if (link) {
            return {
                id: link.agentId,
                name: link.agentName,
                status: 'active',
                voice: 'alloy',
                language: 'en-US',
                linkedAt: link.linkedAt
            };
        }

        return {
            id: 'agent_001',
            name: 'Twilio Voice Agent (Mock)',
            status: 'active',
            voice: 'alloy',
            language: 'en-US',
            linkedAt: new Date().toISOString()
        };
    }

    try {
        const response = await voiceCakeClient.get(`/tenant/${tenantId}/agent`);
        return response.data.agent || response.data;
    } catch (error) {
        if (error.response?.status === 404) return null;
        console.error('Error fetching tenant agent:', error.response?.data || error.message);
        throw error;
    }
}

// ============================================================================
// LEGACY COMPATIBILITY (for backward compatibility with existing code)
// ============================================================================

/**
 * @deprecated Use getCallStatus instead
 */
async function getCallDetails(callId) {
    console.warn('getCallDetails is deprecated, use getCallStatus instead');
    return getCallStatus(callId);
}

/**
 * @deprecated Use getAllAgents instead
 */
async function listCalls(limit = 50) {
    console.warn('listCalls is deprecated, use getVoiceStats instead');
    if (isMockMode) {
        return [];
    }
    try {
        const response = await voiceCakeClient.get('/calls', { params: { limit } });
        return response.data;
    } catch (error) {
        console.error('Error listing calls:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * @deprecated Use getAgent instead
 */
async function getAgentConfig() {
    console.warn('getAgentConfig is deprecated, use getAgent instead');
    if (isMockMode) {
        return {
            configured: true,
            name: 'Mock Agent',
        };
    }
    try {
        const response = await voiceCakeClient.get('/agent');
        return response.data;
    } catch (error) {
        console.error('Error getting agent config:', error.response?.data || error.message);
        throw error;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Agents API
    getAllAgents,
    getAgent,
    deleteAgent,
    getAgentTools,
    getAgentStats,
    checkPhoneNumberAvailability,

    // Voice API
    initiateOutboundCall,
    getCallStatus,
    hangupCall,
    getPhoneNumbers,
    updatePhoneNumberWebhook,
    getVoiceStats,

    // Tenant API
    linkAgentToTenant,
    getTenantAgent,

    // Legacy/Deprecated (for backward compatibility)
    getCallDetails,
    listCalls,
    getAgentConfig,

    // Utilities
    isMockMode: () => isMockMode
};