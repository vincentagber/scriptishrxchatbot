// backend/routes/auth.js

const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { registerSchema, loginSchema } = require('../schemas/validation');

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET || process.env.JWT_SECRET;

if (!JWT_SECRET) throw new Error('FATAL: JWT_SECRET not defined');

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
};

//Include tenantId in BOTH access & refresh tokens
const generateTokens = (user) => {
    const accessToken = jwt.sign(
        {
            userId: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId  
        },
        JWT_SECRET,
        { expiresIn: '24h' }  // 24h is better than 15m for dashboard use
    );

    const refreshToken = jwt.sign(
        {
            userId: user.id,
            tenantId: user.tenantId  
        },
        REFRESH_SECRET,
        { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
};

// Register — unchanged (already perfect)
router.post('/register', async (req, res) => {
    try {
        const validated = registerSchema.parse(req.body);
        const { email, password, name, companyName, location, timezone } = validated;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(400).json({ error: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await prisma.$transaction(async (prisma) => {
            const tenant = await prisma.tenant.create({
                data: { name: companyName, location, timezone },
            });
            const user = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    role: 'OWNER',
                    tenantId: tenant.id,
                },
            });
            // 14-Day Free Trial Logic
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 14);

            await prisma.subscription.create({
                data: {
                    userId: user.id,
                    plan: 'Trial', // Was 'Basic'
                    status: 'Active',
                    endDate: trialEndDate
                },
            });
            return { tenant, user };
        });

        const { user, tenant } = result;
        const { accessToken, refreshToken } = generateTokens(user);

        res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);

        res.status(201).json({
            token: accessToken,
            user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: tenant.id },
            tenant: { id: tenant.id, name: tenant.name }
        });
    } catch (error) {
        if (error.name === 'ZodError') return res.status(400).json({ error: error.errors });
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login — NOW WORKS WITH VOICECAKE
router.post('/login', async (req, res) => {
    try {
        const result = loginSchema.safeParse(req.body);
        if (!result.success) return res.status(400).json({ error: result.error.errors[0].message });

        const { email, password } = result.data;
        const user = await prisma.user.findUnique({
            where: { email },
            include: { tenant: true } // optional: for debugging
        });

        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const { accessToken, refreshToken } = generateTokens(user);

        res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);

        res.json({
            success: true,
            token: accessToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                tenantId: user.tenantId   // ← This is now in token!
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Refresh & Logout — unchanged
router.post('/refresh', async (req, res) => {
    // ... your existing code
});

router.post('/logout', (req, res) => {
    res.clearCookie('refresh_token');
    res.json({ success: true, message: 'Logged out' });
});

module.exports = router;