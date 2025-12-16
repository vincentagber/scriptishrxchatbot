// backend/src/routes/bookings.js
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission, verifyTenantAccess } = require('../middleware/permissions');
const { checkSubscriptionAccess } = require('../middleware/subscription');

/**
 * GET /api/bookings - List all bookings for the tenant
 */
router.get('/',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('bookings', 'read'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { status, clientId, from, to } = req.query;

            const whereClause = { tenantId };

            if (status) whereClause.status = status;
            if (clientId) whereClause.clientId = clientId;

            if (from || to) {
                whereClause.date = {};
                if (from) whereClause.date.gte = new Date(from);
                if (to) whereClause.date.lte = new Date(to);
            }

            const bookings = await prisma.booking.findMany({
                where: whereClause,
                include: {
                    client: {
                        select: {
                            id: true,
                            name: true,
                            phone: true,
                            email: true
                        }
                    }
                },
                orderBy: { date: 'asc' }
            });

            res.json({ success: true, bookings });
        } catch (error) {
            console.error('Error fetching bookings:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch bookings'
            });
        }
    }
);

/**
 * POST /api/bookings - Create a new booking
 */
router.post('/',
    authenticateToken,
    verifyTenantAccess,
    checkSubscriptionAccess,
    checkPermission('bookings', 'create'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { clientId, date, purpose, status } = req.body;

            if (!clientId || !date) {
                return res.status(400).json({
                    success: false,
                    error: 'Client ID and date are required'
                });
            }

            // Verify client belongs to tenant
            const client = await prisma.client.findFirst({
                where: { id: clientId, tenantId }
            });

            if (!client) {
                return res.status(404).json({
                    success: false,
                    error: 'Client not found in your organization'
                });
            }

            const booking = await prisma.booking.create({
                data: {
                    clientId,
                    date: new Date(date),
                    purpose: purpose || '',
                    status: status || 'Scheduled',
                    tenantId
                },
                include: {
                    client: {
                        select: {
                            id: true,
                            name: true,
                            phone: true,
                            email: true
                        }
                    }
                }
            });

            res.status(201).json({
                success: true,
                booking,
                message: 'Booking created successfully'
            });
        } catch (error) {
            console.error('Error creating booking:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create booking'
            });
        }
    }
);

/**
 * PATCH /api/bookings/:id - Update a booking
 */
router.patch('/:id',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('bookings', 'update'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { id } = req.params;
            const { date, purpose, status } = req.body;

            // Verify booking belongs to tenant
            const existingBooking = await prisma.booking.findFirst({
                where: { id, tenantId }
            });

            if (!existingBooking) {
                return res.status(404).json({
                    success: false,
                    error: 'Booking not found'
                });
            }

            const updateData = {};
            if (date !== undefined) updateData.date = new Date(date);
            if (purpose !== undefined) updateData.purpose = purpose;
            if (status !== undefined) updateData.status = status;

            const booking = await prisma.booking.update({
                where: { id },
                data: updateData,
                include: {
                    client: {
                        select: {
                            id: true,
                            name: true,
                            phone: true,
                            email: true
                        }
                    }
                }
            });

            res.json({
                success: true,
                booking,
                message: 'Booking updated successfully'
            });
        } catch (error) {
            console.error('Error updating booking:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update booking'
            });
        }
    }
);

/**
 * DELETE /api/bookings/:id - Delete a booking
 */
router.delete('/:id',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('bookings', 'delete'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { id } = req.params;

            // Verify booking belongs to tenant
            const booking = await prisma.booking.findFirst({
                where: { id, tenantId }
            });

            if (!booking) {
                return res.status(404).json({
                    success: false,
                    error: 'Booking not found'
                });
            }

            await prisma.booking.delete({
                where: { id }
            });

            res.json({
                success: true,
                message: 'Booking deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting booking:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete booking'
            });
        }
    }
);

module.exports = router;
