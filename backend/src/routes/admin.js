const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/auth');
const requireRole = require('../middleware/rbac');
const logger = require('../utils/logger');

// GET /api/admin/subscribers/summary
// Access: SUPER_ADMIN ONLY
router.get('/subscribers/summary', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
    try {
        // 1. Total Subscribers
        const totalSubscribers = await prisma.subscription.count();

        // 2. Breakdown by Type (Individual vs Organization)
        const typeBreakdown = await prisma.subscription.groupBy({
            by: ['type'],
            _count: {
                id: true
            }
        });

        // 3. Breakdown by Status (Active, Inactive, etc.)
        const statusBreakdown = await prisma.subscription.groupBy({
            by: ['status'],
            _count: {
                id: true
            }
        });

        // 4. Breakdown by Plan
        const planBreakdown = await prisma.subscription.groupBy({
            by: ['plan'],
            _count: {
                id: true
            }
        });

        // Format for response
        const responseData = {
            totalSubscribers,
            breakdown: typeBreakdown.reduce((acc, curr) => ({ ...acc, [curr.type]: curr._count.id }), {}),
            status: statusBreakdown.reduce((acc, curr) => ({ ...acc, [curr.status]: curr._count.id }), {}),
            plans: planBreakdown.reduce((acc, curr) => ({ ...acc, [curr.plan]: curr._count.id }), {})
        };

        res.json({
            success: true,
            data: responseData
        });

    } catch (error) {
        logger.error('Admin Summary Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch subscriber summary' });
    }
});

module.exports = router;
