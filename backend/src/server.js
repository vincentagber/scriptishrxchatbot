const dotenv = require('dotenv');
const path = require('path');

// Load environment variables (Check multiple locations for deployment flexibility)
const envPaths = [
    path.resolve(__dirname, '../../.env'), // Monorepo root
    path.resolve(__dirname, '../.env'),    // Backend root (if deployed separately)
    path.resolve(__dirname, '.env')        // Src root
];

envPaths.forEach(envPath => {
    dotenv.config({ path: envPath });
});

const app = require('./app');
const http = require('http');

// Port configuration (Critical for cPanel/Phusion Passenger)
// Passenger often passes the port/socket as a string via process.env.PORT
const PORT = process.env.PORT || 5000;

// Validate critical env vars
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.error('🔴 FATAL: JWT_SECRET is not defined in production environment.');
    process.exit(1);
}

// PRODUCTION REQUIREMENT: OpenAI API key
if (!process.env.OPENAI_API_KEY) {
    console.error('🔴 CRITICAL: OPENAI_API_KEY is not set!');
    console.error('AI features will NOT work without this.');
    console.error('Set OPENAI_API_KEY in your .env file.');

    if (process.env.NODE_ENV === 'production') {
        console.error('🔴 FATAL: Cannot run in production without OpenAI API key.');
        process.exit(1);
    }
}


const server = http.createServer(app);

// Initialize Socket.IO
const socketService = require('./services/socketService');
const io = socketService.init(server);
console.log('socket.io initialized');

// WebSocket handling (Native WS for Twilio Media Streams)
const WebSocket = require('ws');
const wss = new WebSocket.Server({
    server,
    path: '/api/voice/stream'
});

// Import Voice Service
const voiceService = require('./services/voiceService');

wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`New WebSocket connection from ${clientIp}`);

    try {
        voiceService.handleConnection(ws, req);
    } catch (error) {
        console.error('Error handling WebSocket connection:', error);
        ws.close();
    }
});

wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
});

// Listen on PORT (can be a number or a named pipe string)
// Do NOT specify '0.0.0.0' or 'localhost' as it breaks named pipe support
server.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('ScriptishRx API Server Started Successfully');
    console.log('='.repeat(60));
    console.log(`Listening on:    ${typeof PORT === 'string' ? 'Named Pipe/Socket' : 'Port ' + PORT}`);
    console.log(`WebSocket:       ws://localhost:${PORT}/api/voice/stream`);
    console.log(`Environment:     ${process.env.NODE_ENV || 'development'}`);
    console.log(`Root Directory:  ${path.resolve(__dirname, '../..')}`);
    console.log('\nConfiguration Status:');
    console.log(`   JWT Secret:      ${process.env.JWT_SECRET ? '✓ Set' : '✗ Missing'}`);
    console.log(`   OpenAI API:      ${process.env.OPENAI_API_KEY ? '✓ Set' : '⚠ Not set'}`);
    console.log('='.repeat(60) + '\n');

    // Log available routes
    console.log('Testing routes:');
    console.log(`   curl http://localhost:${PORT}/`);
    console.log(`   curl http://localhost:${PORT}/api/chat/status`);
    console.log('');
});

// Graceful shutdown
const shutdown = (signal) => {
    console.log(`\n${signal} received: shutting down gracefully...`);

    // Close all WebSocket connections
    wss.clients.forEach((client) => {
        client.close();
    });

    server.close(() => {
        console.log('HTTP server closed');
        console.log('All connections closed');
        process.exit(0);
    });

    // Force shutdown after timeout
    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = { app, server, wss };