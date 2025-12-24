// backend/src/services/chatService.js
/**
 * Chat Service - Production OpenAI Integration
 * NO MOCK MODE - Uses real OpenAI API for all chat and voice functionality
 */

const prisma = require('../lib/prisma');

// PRODUCTION MODE: Require OpenAI API key
if (!process.env.OPENAI_API_KEY) {
    console.error('🔴 CRITICAL: OPENAI_API_KEY is not set!');
    console.error('Chat and voice AI features will not work without OpenAI API key.');
    console.error('Set OPENAI_API_KEY in your .env file.');
}

const hasOpenAI = !!process.env.OPENAI_API_KEY;

console.log(`[Chat Service] AI Provider: ${hasOpenAI ? 'OPENAI (PRODUCTION)' : 'NOT CONFIGURED'}`);

/**
 * Get chat history for a tenant (includes voice transcripts for unified context)
 * @param {string} tenantId 
 * @param {object} options - { includeVoice: boolean, limit: number }
 */
async function getChatHistory(tenantId, options = {}) {
    const { includeVoice = true, limit = 50 } = options;

    try {
        const where = { tenantId };

        // Optionally filter to only chat messages
        if (!includeVoice) {
            where.source = 'chat';
        }

        const messages = await prisma.message.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            take: limit,
            select: {
                id: true,
                role: true,
                content: true,
                source: true,
                callSessionId: true,
                createdAt: true
            }
        });
        return messages;
    } catch (error) {
        console.error('Error fetching history from DB:', error);
        return [];
    }
}

/**
 * Add message to chat history
 * @param {string} tenantId 
 * @param {string} role - 'user' or 'assistant'
 * @param {string} content 
 * @param {object} metadata - { sessionId, source, callSessionId }
 */
async function addToHistory(tenantId, role, content, metadata = {}) {
    try {
        const message = await prisma.message.create({
            data: {
                tenantId,
                role,
                content,
                sessionId: metadata.sessionId || 'default',
                source: metadata.source || 'chat',
                callSessionId: metadata.callSessionId || null
            }
        });
        return { ...message, ...metadata };
    } catch (error) {
        console.error('Error saving message to DB:', error);
        // Fallback to memory object if DB fails
        return {
            id: `temp_${Date.now()}`,
            role,
            content,
            source: metadata.source || 'chat',
            timestamp: new Date().toISOString(),
            ...metadata
        };
    }
}

/**
 * Call OpenAI API for chat completion
 */
const OpenAI = require('openai');

// Initialize OpenAI Client
const openai = hasOpenAI ? new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
}) : null;

/**
 * Call OpenAI API for chat completion
 */
async function callOpenAI(message, tenantId) {
    if (!hasOpenAI || !openai) {
        throw new Error('OpenAI API key not configured. Cannot process chat request.');
    }

    try {
        // Get tenant-specific configuration
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });

        // Use custom system prompt from AI Config (Primary) or legacy field
        const aiConfig = tenant?.aiConfig || {};
        let systemPrompt = aiConfig.systemPrompt || tenant?.customSystemPrompt || generateDefaultPrompt(tenant);

        // Append Tenant FAQs if available (Basic RAG)
        if (aiConfig.faqs && Array.isArray(aiConfig.faqs) && aiConfig.faqs.length > 0) {
            const faqSection = `\n\nHere is your knowledge base for ${tenant.name || 'this organization'}:\n${aiConfig.faqs.map(f => `- Q: ${f.question}\n  A: ${f.answer}`).join('\n')}`;
            systemPrompt += faqSection;
        }

        // Get conversation context
        const context = await getChatHistory(tenantId);
        const recentContext = context.slice(-10); // Last 10 messages for context

        // Build messages array for OpenAI
        const openaiMessages = [
            {
                role: 'system',
                content: systemPrompt
            },
            ...recentContext.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            })),
            {
                role: 'user',
                content: message
            }
        ];

        console.log('[OpenAI] Sending request with', openaiMessages.length, 'messages');

        const completion = await openai.chat.completions.create({
            model: aiConfig.model || process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            messages: openaiMessages,
            max_tokens: aiConfig.maxTokens || 500,
            temperature: aiConfig.temperature || 0.7
        });

        const aiResponse = completion.choices[0]?.message?.content;

        if (!aiResponse) {
            throw new Error('No response from OpenAI');
        }

        console.log('[OpenAI] Response received successfully');

        return {
            success: true,
            response: aiResponse,
            provider: 'openai',
            model: completion.model,
            usage: completion.usage
        };
    } catch (error) {
        console.error('[OpenAI] Error:', error);
        throw error;
    }
}

/**
 * Process a chat message and get AI response
 */
async function processMessage(message, tenantId) {
    try {
        if (!hasOpenAI) {
            return {
                success: false,
                error: 'OpenAI API key not configured. Please contact support.',
                code: 'NO_API_KEY'
            };
        }

        // Add user message to history
        await addToHistory(tenantId, 'user', message);

        // Call OpenAI
        console.log('[Chat] Processing message with OpenAI');
        const result = await callOpenAI(message, tenantId);

        // Add AI response to history
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
        console.error('[Chat] Process message error:', error);

        // Provide helpful error message to user
        const userFriendlyError = error.message.includes('API key')
            ? 'AI service configuration error. Please contact support.'
            : 'There was an error processing your message. Please try again.';

        return {
            success: false,
            error: userFriendlyError,
            details: error.message, // For debugging
            code: 'PROCESSING_ERROR'
        };
    }
}

/**
 * Process voice input with OpenAI Whisper
 */
async function processVoiceInput(audioData, tenantId) {
    if (!hasOpenAI) {
        return {
            success: false,
            error: 'OpenAI API key not configured. Voice features unavailable.',
            code: 'NO_API_KEY'
        };
    }

    try {
        console.log('[Voice] Processing audio with OpenAI Whisper');

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
            const errorText = await transcriptionResponse.text();
            console.error('[Whisper] Error:', errorText);
            throw new Error(`Whisper API error: ${transcriptionResponse.status}`);
        }

        const transcriptionData = await transcriptionResponse.json();
        const transcript = transcriptionData.text;

        console.log('[Whisper] Transcription successful:', transcript);

        // Add transcribed message to history
        await addToHistory(tenantId, 'user', transcript, {
            type: 'voice',
            provider: 'openai-whisper'
        });

        // Get AI response for the transcribed text
        const aiResult = await processMessage(transcript, tenantId);

        return {
            success: true,
            transcript: transcript,
            response: aiResult.response,
            provider: 'openai',
            metadata: aiResult.metadata
        };
    } catch (error) {
        console.error('[Voice] Processing error:', error);
        return {
            success: false,
            error: 'Failed to process voice input. Please try again.',
            details: error.message,
            code: 'VOICE_PROCESSING_ERROR'
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
        console.log(`[Chat] Cleared history for tenant: ${tenantId}`);
        return { success: true };
    } catch (error) {
        console.error('Error clearing history:', error);
        throw error;
    }
}

/**
 * Get conversation context (last N messages)
 */
async function getConversationContext(tenantId, limit = 10) {
    const history = await getChatHistory(tenantId);
    return history.slice(-limit);
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

    return `You are ${aiName}, the AI assistant for ${businessName}. Your role is to:
- Help customers with bookings, appointments, and inquiries
- Answer questions about services, pricing, and availability
- Provide friendly and professional customer support
- Direct complex issues to human staff when needed
- Maintain a helpful and approachable tone

Be concise, professional, and always put the customer first.`;
}

/**
 * Get current AI provider info
 */
function getProviderInfo() {
    return {
        provider: hasOpenAI ? 'openai' : 'not_configured',
        configured: hasOpenAI,
        capabilities: {
            chat: hasOpenAI,
            voice: hasOpenAI,
            voiceTranscription: hasOpenAI,
            voiceSynthesis: false // TTS not implemented yet
        }
    };
}

/**
 * Get unified conversation history across all channels (chat, voice, sms)
 * Groups messages by call session for voice calls
 */
async function getUnifiedHistory(tenantId, options = {}) {
    const { limit = 100 } = options;

    try {
        // Get all messages
        const messages = await prisma.message.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'asc' },
            take: limit,
            include: {
                callSession: {
                    select: {
                        id: true,
                        callerPhone: true,
                        summary: true,
                        status: true
                    }
                }
            }
        });

        // Group and format for unified view
        const unified = messages.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            source: msg.source,
            timestamp: msg.createdAt,
            callContext: msg.callSession ? {
                sessionId: msg.callSession.id,
                phone: msg.callSession.callerPhone,
                summary: msg.callSession.summary
            } : null
        }));

        return unified;
    } catch (error) {
        console.error('Error fetching unified history:', error);
        return [];
    }
}

module.exports = {
    getChatHistory,
    addToHistory,
    processMessage,
    processVoiceInput,
    clearChatHistory,
    getConversationContext,
    getProviderInfo,
    getUnifiedHistory
};