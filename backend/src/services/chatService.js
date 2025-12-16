// backend/src/services/chatService.js
const voiceCakeService = require('./voiceCakeService');

const isMockMode = process.env.MOCK_EXTERNAL_SERVICES === 'true' ||
    (!process.env.VOICECAKE_API_KEY && !process.env.OPENAI_API_KEY);

const hasVoiceCake = !!process.env.VOICECAKE_API_KEY;
const hasOpenAI = !!process.env.OPENAI_API_KEY;

// Determine which AI provider to use
const aiProvider = hasVoiceCake ? 'voicecake' : hasOpenAI ? 'openai' : 'mock';

console.log(`[Chat Service] AI Provider: ${aiProvider.toUpperCase()}`);
if (isMockMode) console.log('[Chat Service] Running in MOCK MODE');

const prisma = require('../lib/prisma');

// ... (keep surrounding code)

/**
 * Get chat history for a tenant
 */
async function getChatHistory(tenantId) {
    try {
        const messages = await prisma.message.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'asc' }, // Ensure oldest first (top) -> newest last (bottom)
            take: 50 // Limit content size
        });
        return messages;
    } catch (error) {
        console.error('Error fetching history from DB:', error);
        return [];
    }
}

/**
 * Add message to chat history
 */
async function addToHistory(tenantId, role, content, metadata = {}) {
    try {
        const message = await prisma.message.create({
            data: {
                tenantId,
                role,
                content,
                sessionId: 'default', // Single session for now
                // Metadata could be stored in a JSON field if schema allowed, but for now we simplify
            }
        });
        return { ...message, ...metadata };
    } catch (error) {
        console.error('Error saving message to DB:', error);
        // Fallback to memory object if DB fails so chat doesn't break UI
        return {
            id: `temp_${Date.now()}`,
            role,
            content,
            timestamp: new Date().toISOString(),
            ...metadata
        };
    }
}

/**
 * Call OpenAI API for chat completion
 */
async function callOpenAI(messages, tenantId) {
    try {
        // Get tenant-specific configuration
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });

        // Use custom system prompt from tenant settings, or default to business-neutral template
        const systemPrompt = tenant?.customSystemPrompt || generateDefaultPrompt(tenant);

        // Get conversation context
        const context = await getChatHistory(tenantId);
        const recentContext = context.slice(-10); // Last 10 messages

        // Build messages array for OpenAI
        const openaiMessages = [
            {
                role: 'system',
                content: systemPrompt
            },
            ...recentContext.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            }))
        ];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
                messages: openaiMessages,
                max_tokens: 500,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        const aiResponse = data.choices[0]?.message?.content;

        if (!aiResponse) {
            throw new Error('No response from OpenAI');
        }

        return {
            success: true,
            response: aiResponse,
            provider: 'openai',
            model: data.model,
            usage: data.usage
        };
    } catch (error) {
        console.error('OpenAI API error:', error);
        throw error;
    }
}

/**
 * Process a chat message and get AI response
 */
async function processMessage(message, tenantId) {
    try {
        // Add user message to history
        await addToHistory(tenantId, 'user', message);

        // Mock Mode
        if (isMockMode) {
            const mockResponses = [
                "I understand your question. In mock mode, I'm simulating an AI assistant response.",
                "That's an interesting point! Let me help you with that. (This is a mock response)",
                "I can definitely assist you with that. Since we're in mock mode, this is a simulated response.",
                "Great question! Here's what I think... (Mock AI response for testing)",
                "I'd be happy to help! In production, this would be powered by VoiceCake or OpenAI.",
                "Let me process that for you. (Simulated AI response in development mode)",
                "Excellent! I'm here to assist. (This is a test response while in mock mode)",
                "I hear you! Let me think about that... (Mock AI assistant response)"
            ];

            const response = mockResponses[Math.floor(Math.random() * mockResponses.length)];
            await addToHistory(tenantId, 'assistant', response, { mockMode: true, provider: 'mock' });

            await new Promise(resolve => setTimeout(resolve, 800));

            return {
                success: true,
                response: response,
                metadata: {
                    mockMode: true,
                    provider: 'mock',
                    processingTime: 800
                }
            };
        }

        // OpenAI Mode
        if (aiProvider === 'openai') {
            try {
                console.log('[Chat] Using OpenAI for response');
                const result = await callOpenAI(message, tenantId);

                await addToHistory(tenantId, 'assistant', result.response, {
                    provider: 'openai',
                    model: result.model
                });

                return {
                    success: true,
                    response: result.response,
                    metadata: {
                        provider: 'openai',
                        model: result.model,
                        usage: result.usage
                    }
                };
            } catch (error) {
                console.error('OpenAI error, falling back to mock:', error);
                const fallbackResponse = "I'm having trouble connecting to OpenAI. Please try again in a moment.";
                addToHistory(tenantId, 'assistant', fallbackResponse, { error: true, provider: 'openai-error' });

                return {
                    success: true,
                    response: fallbackResponse,
                    metadata: {
                        error: error.message,
                        provider: 'openai-fallback'
                    }
                };
            }
        }

        // VoiceCake Mode
        if (aiProvider === 'voicecake') {
            try {
                console.log('[Chat] Using VoiceCake for response');
                const agent = await voiceCakeService.getTenantAgent(tenantId);

                if (!agent) {
                    throw new Error('No AI agent configured');
                }

                // TODO: Implement actual VoiceCake chat API
                const response = "AI chat via VoiceCake is being configured. This feature will be fully operational soon.";

                await addToHistory(tenantId, 'assistant', response, {
                    agentId: agent.id,
                    agentName: agent.name,
                    provider: 'voicecake'
                });

                return {
                    success: true,
                    response: response,
                    metadata: {
                        agentId: agent.id,
                        agentName: agent.name,
                        provider: 'voicecake'
                    }
                };
            } catch (error) {
                console.error('VoiceCake error:', error);

                // Fallback to OpenAI if available
                if (hasOpenAI) {
                    console.log('[Chat] Falling back to OpenAI');
                    try {
                        const result = await callOpenAI(message, tenantId);
                        addToHistory(tenantId, 'assistant', result.response, {
                            provider: 'openai-fallback',
                            model: result.model
                        });

                        return {
                            success: true,
                            response: result.response,
                            metadata: {
                                provider: 'openai-fallback',
                                model: result.model,
                                originalProvider: 'voicecake'
                            }
                        };
                    } catch (openaiError) {
                        console.error('OpenAI fallback also failed:', openaiError);
                    }
                }

                const fallbackResponse = "I'm having trouble connecting to the AI service. Please try again in a moment.";
                addToHistory(tenantId, 'assistant', fallbackResponse, { error: true });

                return {
                    success: true,
                    response: fallbackResponse,
                    metadata: {
                        error: error.message
                    }
                };
            }
        }
    } catch (error) {
        console.error('Chat service error:', error);
        return {
            success: false,
            error: error.message || 'Failed to process message'
        };
    }
}

/**
 * Process voice input with OpenAI Whisper or VoiceCake
 */
async function processVoiceInput(audioData, tenantId) {
    try {
        // OpenAI Whisper for transcription
        if (hasOpenAI) {
            try {
                console.log('[Voice] Using OpenAI Whisper for transcription');

                // Convert base64 to buffer
                const audioBuffer = Buffer.from(audioData, 'base64');

                // Create form data
                const FormData = require('form-data');
                const form = new FormData();
                form.append('file', audioBuffer, {
                    filename: 'audio.wav',
                    contentType: 'audio/wav'
                });
                form.append('model', 'whisper-1');

                const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        ...form.getHeaders()
                    },
                    body: form
                });

                if (!transcriptionResponse.ok) {
                    throw new Error(`Whisper API error: ${transcriptionResponse.status}`);
                }

                const transcriptionData = await transcriptionResponse.json();
                const transcript = transcriptionData.text;

                // Add transcribed message to history
                addToHistory(tenantId, 'user', transcript, {
                    type: 'voice',
                    provider: 'openai-whisper'
                });

                // Get AI response for the transcribed text
                const aiResult = await processMessage(transcript, tenantId);

                return {
                    success: true,
                    transcript: transcript,
                    response: aiResult.response,
                    provider: 'openai'
                };
            } catch (error) {
                console.error('OpenAI Whisper error:', error);
                throw error;
            }
        }

        // Mock Mode
        if (isMockMode) {
            const mockTranscript = "This is a mock transcript of your voice input.";
            const mockResponse = "I heard you say: " + mockTranscript + " (Mock response)";

            addToHistory(tenantId, 'user', mockTranscript, {
                type: 'voice',
                mockMode: true
            });

            addToHistory(tenantId, 'assistant', mockResponse, {
                mockMode: true
            });

            return {
                success: true,
                transcript: mockTranscript,
                response: mockResponse,
                provider: 'mock'
            };
        }

        // VoiceCake Mode
        return {
            success: false,
            error: 'Voice processing requires OpenAI API key'
        };
    } catch (error) {
        console.error('Voice processing error:', error);
        return {
            success: false,
            error: error.message || 'Failed to process voice input'
        };
    }
}

/**
 * Clear chat history for a tenant
 */
async function clearChatHistory(tenantId) {
    try {
        await prisma.message.deleteMany({
            where: { tenantId }
        });
        console.log(`[Chat] Cleared DB history for tenant: ${tenantId}`);
    } catch (error) {
        console.error('Error clearing history:', error);
        throw error;
    }
}

/**
 * Get conversation context for AI (last N messages)
 */
function getConversationContext(tenantId, limit = 10) {
    // This is now deprecated in favor of getChatHistory
    return getChatHistory(tenantId).then(history => history.slice(-limit));
}

/**
 * Generate default system prompt based on tenant configuration
 */
function generateDefaultPrompt(tenant) {
    if (!tenant) {
        return `You are a helpful AI assistant. Be friendly, professional, and concise in your responses. Help users with their questions about bookings, services, and general inquiries.`;
    }

    const businessName = tenant.name || 'our business';
    const aiName = tenant.aiName || 'AI Assistant';
    const welcomeMessage = tenant.aiWelcomeMessage || `Welcome to ${tenant.name}! How can I help you today?`;

    // Industry-specific templates (can be extended)
    const industryPrompts = {
        wellness: `You are ${aiName}, the AI assistant for ${businessName}, a wellness and health business. Your role is to:
- Help customers book appointments and services
- Answer questions about our wellness services, pricing, and availability
- Provide friendly, health-conscious guidance
- Direct complex medical questions to our professionals
- Maintain a calm, supportive, and professional tone
Be concise, empathetic, and always protect client privacy.`,

        travel: `You are ${aiName}, the AI assistant for ${businessName}, a travel and booking service. Your role is to:
- Assist with travel bookings and itinerary questions
- Provide information about destinations, pricing, and availability
- Help with reservation modifications and inquiries
- Offer friendly travel recommendations
- Maintain an enthusiastic and helpful tone
Be concise, informative, and inspire wanderlust.`,

        retail: `You are ${aiName}, the AI assistant for ${businessName}. Your role is to:
- Help customers find products and services
- Answer questions about inventory, pricing, and availability
- Assist with order tracking and inquiries
- Provide excellent customer service
- Maintain a friendly and professional tone
Be helpful, knowledgeable, and drive positive customer experiences.`,

        default: `You are ${aiName}, the AI assistant for ${businessName}. Your role is to:
- Help customers with bookings, appointments, and inquiries
- Answer questions about services, pricing, and availability
- Provide friendly and professional customer support
- Direct complex issues to human staff when needed
- Maintain a helpful and approachable tone
Be concise, professional, and always put the customer first.`
    };

    // Return default prompt (can be enhanced to detect industry from tenant settings)
    return industryPrompts.default;
}

/**
 * Get current AI provider info
 */
function getProviderInfo() {
    return {
        provider: aiProvider,
        mockMode: isMockMode,
        hasVoiceCake: hasVoiceCake,
        hasOpenAI: hasOpenAI,
        capabilities: {
            chat: true,
            voice: hasOpenAI || isMockMode,
            voiceTranscription: hasOpenAI,
            voiceSynthesis: hasOpenAI
        }
    };
}

module.exports = {
    getChatHistory,
    addToHistory,
    processMessage,
    processVoiceInput,
    clearChatHistory,
    getConversationContext,
    getProviderInfo
};