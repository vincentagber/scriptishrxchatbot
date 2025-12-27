const jwt = require('jsonwebtoken');

// SECURITY: Enforce strong JWT secret - no weak fallbacks allowed
const JWT_SECRET = process.env.JWT_SECRET;

// Validate JWT secret strength
if (!JWT_SECRET) {
    console.error('🔴 CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not set!');
    console.error('Set a strong secret: JWT_SECRET=$(openssl rand -base64 64)');

    if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_SECRET required in production. Cannot start server.');
    }

    // In development only, generate a warning and use temporary secret
    console.warn('⚠️  DEVELOPMENT MODE: Using temporary JWT secret. DO NOT USE IN PRODUCTION!');
    process.env.JWT_SECRET = require('crypto').randomBytes(64).toString('hex');
} else if (JWT_SECRET.length < 32) {
    console.error('🔴 CRITICAL SECURITY ERROR: JWT_SECRET is too weak!');
    console.error(`Current length: ${JWT_SECRET.length} characters. Minimum required: 32 characters.`);
    console.error('Generate a strong secret: JWT_SECRET=$(openssl rand -base64 64)');

    if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_SECRET must be at least 32 characters. Cannot start server.');
    }

    console.warn('⚠️  DEVELOPMENT MODE: Weak JWT secret detected. Using enhanced version.');
    process.env.JWT_SECRET = JWT_SECRET + require('crypto').randomBytes(32).toString('hex');
}


const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        req.user = decoded; // { userId, role, tenantId }
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

module.exports = authMiddleware;
