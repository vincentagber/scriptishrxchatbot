// backend/src/config/voice.js
/**
 * Voice AI Platform Configuration
 * Centralized settings for OpenAI, Twilio, and Voice behaviors.
 */

module.exports = {
    openai: {
        url: 'wss://api.openai.com/v1/realtime',
        model: 'gpt-4o-realtime-preview-2024-12-17', // Latest stable realtime model
        voice: 'alloy', // Default voice
        temperature: 0.8,
        maxRetries: 5,
        initialRetryDelay: 1000, // 1 second
    },
    twilio: {
        timeout: 15, // seconds to wait for initial connection
        mediaFormat: 'g711_ulaw',
    },
    system: {
        defaultInstructions: 'You are a helpful AI assistant. Answer concisely and professionally.',
        bargeInEnabled: true, // Enable interruption handling
        silenceTimeout: 10000, // 10 seconds of silence triggers a nudge (future feature)
    }
};
