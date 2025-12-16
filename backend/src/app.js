const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const app = express();

// Trust Proxy (Crucial for Render/Heroku Rate Limiting)
app.set('trust proxy', 1);

// Security & Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5000', process.env.FRONTEND_URL],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // Default 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many requests, please try again later.'
    }
});

// Apply rate limiting ONLY to API routes, not static files
app.use('/api', limiter);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ==================== IMPORT ROUTES ====================
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const clientsRouter = require('./routes/clients');
const bookingsRouter = require('./routes/bookings');
const minutesRouter = require('./routes/minutes');
const settingsRouter = require('./routes/settings');
const insightsRouter = require('./routes/insights');
const workflowsRouter = require('./routes/workflows');
const notificationsRouter = require('./routes/notifications');
const paymentsRouter = require('./routes/payments');
const uploadRouter = require('./routes/upload');
const voiceRouter = require('./routes/voice');
const webhooksRouter = require('./routes/webhooks');
const marketingRouter = require('./routes/marketing');
const organizationRouter = require('./routes/organization');

// Load AI Chat routes
let chatAIRouter;
try {
    chatAIRouter = require('./routes/chat.routes');
    console.log('✓ AI Chat routes loaded (chat.routes.js)');
} catch (error) {
    console.warn('⚠ AI Chat routes not found - creating fallback');
    chatAIRouter = createFallbackChatRouter();
}

// Load Legacy Chat routes (if exists)
let legacyChatRouter;
try {
    legacyChatRouter = require('./routes/chat');
    console.log('✓ Legacy chat routes loaded');
} catch (error) {
    console.warn('⚠ Legacy chat routes not found');
}

// LOAD VOICECAKE ROUTES
let voiceCakeRouter;
const voiceCakeFilePath = path.join(__dirname, 'routes', 'voicecake.js');

if (fs.existsSync(voiceCakeFilePath)) {
    try {
        voiceCakeRouter = require('./routes/voicecake');
        console.log('✓ VoiceCake routes loaded');
    } catch (err) {
        console.error('ERROR: VoiceCake file exists but failed to load:', err.message);
        console.warn('Falling back to MOCK routes');
        voiceCakeRouter = createMockVoiceCakeRouter();
    }
} else {
    console.warn('WARNING: routes/voicecake.js NOT FOUND → Using mock routes');
    voiceCakeRouter = createMockVoiceCakeRouter();
}

// ==================== HELPER FUNCTIONS ====================

// Fallback AI chat router if chat.routes.js doesn't exist
function createFallbackChatRouter() {
    const router = express.Router();

    // In-memory message storage
    const messages = [];

    router.get('/status', (req, res) => {
        res.json({
            success: true,
            status: 'online',
            mockMode: true,
            provider: 'fallback',
            timestamp: new Date().toISOString()
        });
    });

    router.get('/history', (req, res) => {
        res.json({
            success: true,
            messages: messages,
            total: messages.length
        });
    });

    router.post('/message', (req, res) => {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        // Add user message
        messages.push({
            id: `msg_${Date.now()}`,
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });

        // Generate mock response
        const responses = [
            "I understand your question. This is a fallback AI response.",
            "That's interesting! Let me help you with that. (Fallback mode)",
            "I can assist you with that. This is a simulated response.",
            "Great question! Here's what I think... (Mock AI)",
            "I'd be happy to help! (Test response in fallback mode)",
            "Let me process that for you. (Simulated AI assistant)",
            "Excellent! I'm here to assist. (Fallback chat mode)",
            "I hear you! Let me think about that... (Mock response)"
        ];

        const response = responses[Math.floor(Math.random() * responses.length)];

        // Add assistant message
        messages.push({
            id: `msg_${Date.now() + 1}`,
            role: 'assistant',
            content: response,
            timestamp: new Date().toISOString(),
            mockMode: true
        });

        res.json({
            success: true,
            response: response,
            metadata: {
                mockMode: true,
                fallback: true,
                processingTime: 800
            },
            mockMode: true
        });
    });

    router.delete('/history', (req, res) => {
        messages.length = 0;
        res.json({
            success: true,
            message: 'Chat history cleared (fallback mode)'
        });
    });

    console.log('✓ Fallback chat routes created');
    return router;
}

// Mock VoiceCake router
function createMockVoiceCakeRouter() {
    const router = express.Router();

    router.get('/agents', (req, res) => {
        res.json({
            success: true,
            agents: [
                { id: 'agent_001', name: 'Sales Agent', phone_number: '+15551234567', status: 'active' },
                { id: 'agent_002', name: 'Support Agent', phone_number: '+15559876543', status: 'active' }
            ],
            mockMode: true
        });
    });

    router.get('/tenant/agent', (req, res) => {
        res.json({
            success: true,
            configured: true,
            agent: { id: 'agent_001', name: 'Sales Agent', phone_number: '+15551234567', status: 'active' },
            mockMode: true
        });
    });

    router.post('/calls/outbound', (req, res) => {
        const { phoneNumber } = req.body;
        res.json({
            success: true,
            callId: `mock_${Date.now()}`,
            status: 'initiated',
            message: 'Mock call placed!',
            phoneNumber,
            mockMode: true
        });
    });

    console.log('✓ Mock VoiceCake routes created');
    return router;
}

// ==================== REGISTER ALL ROUTES ====================

// Authentication & Users
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);

// Chat routes - AI chat takes priority on /api/chat
app.use('/api/chat', chatAIRouter);
console.log('→ /api/chat registered (AI Chat)');

// Legacy chat on different path (if it exists)
if (legacyChatRouter) {
    app.use('/api/legacy-chat', legacyChatRouter);
    console.log('→ /api/legacy-chat registered (Legacy)');
}

// Other routes
app.use('/api/clients', clientsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/minutes', minutesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/workflows', workflowsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/voice', voiceRouter);
app.use('/api/voicecake', voiceCakeRouter);
app.use('/webhooks', webhooksRouter);
app.use('/api/marketing', marketingRouter);
app.use('/api/organization', organizationRouter);

const os = require('os');

// ==================== ACTIVE USER TRACKING ====================
// Simple in-memory tracker for "users active in last 5 minutes"
const activeUsers = new Map(); // UserId -> Timestamp

// Middleware to update active status
app.use((req, res, next) => {
    if (req.user && req.user.id) {
        activeUsers.set(req.user.id, Date.now());
    }
    // Cleanup old users every ~100 requests (optimization)
    if (Math.random() > 0.99) {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        for (const [uid, timestamp] of activeUsers.entries()) {
            if (timestamp < fiveMinutesAgo) activeUsers.delete(uid);
        }
    }
    next();
});

// ==================== HEALTH / SYSTEM STATUS ====================
app.get('/api/health', (req, res) => {
    // 1. Calculate Active Users (cleanup first)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    let currentActive = 0;
    for (const [uid, timestamp] of activeUsers.entries()) {
        if (timestamp > fiveMinutesAgo) currentActive++;
        else activeUsers.delete(uid);
    }
    // Add a minimum floor of 1 (the requester) if auth'd, or just a baseline for realistic feel if dev
    if (currentActive === 0 && process.env.NODE_ENV === 'development') currentActive = 1;

    // 2. Calculate System Load using OS module
    const cpus = os.cpus().length;
    const loadAvg = os.loadavg()[0]; // 1 minute load avg
    // Normalize load to percentage (can exceed 100% if overloaded, cap at 100 for UI)
    const loadPercentage = Math.min(Math.round((loadAvg / cpus) * 100), 100) || 5;

    // 3. Memory Usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercentage = Math.round((usedMem / totalMem) * 100);

    res.json({
        status: 'ok',
        version: '2.0.0',
        system: {
            activeUsers: currentActive,
            cpuLoad: loadPercentage, // "System Load"
            memoryUsage: memPercentage
        },
        env: process.env.NODE_ENV,
        routes: {
            auth: true,
            users: true,
            chat: true,
            legacyChat: !!legacyChatRouter,
            clients: true,
            bookings: true,
            voicecake: fs.existsSync(voiceCakeFilePath) ? 'REAL' : 'MOCK',
            voice: true,
            webhooks: true
        }
    });
});

// Serve Frontend Static Files (SPA)
const publicPath = path.join(__dirname, '../public');
if (fs.existsSync(publicPath)) {
    console.log(`✓ Serving static files from: ${publicPath}`);
    app.use(express.static(publicPath));

    // SPA Fallback: Serve index.html for any unknown route that isn't /api
    // Note: Using (.*) for wildcard compatibility with newer Express routers
    app.get(/(.*)/, (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/media-stream')) return next();
        res.sendFile(path.join(publicPath, 'index.html'));
    });
} else {
    console.warn('⚠ No frontend build found in public directory');
    app.get('/', (req, res) => {
        res.status(200).send('ScriptishRx API is running. Frontend build not matched.');
    });
}

// ==================== ERROR HANDLERS ====================

// 404 Handler
app.use((req, res) => {
    console.log(`404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.path,
        method: req.method,
        hint: 'Check /health or / for available routes'
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack
        })
    });
});

module.exports = app;