// backend/src/routes/clients.js
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission, verifyTenantAccess } = require('../middleware/permissions');
const { checkSubscriptionAccess } = require('../middleware/subscription');

/**
 * GET /api/clients - List all clients for the tenant
 */
router.get('/',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('clients', 'read'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { search } = req.query;

            const whereClause = { tenantId };

            if (search) {
                whereClause.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search } }
                ];
            }

            const clients = await prisma.client.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                include: {
                    bookings: {
                        take: 5,
                        orderBy: { date: 'desc' }
                    }
                }
            });

            res.json({ success: true, clients });
        } catch (error) {
            console.error('Error fetching clients:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch clients'
            });
        }
    }
);

/**
 * GET /api/clients/stats - Get client statistics
 */
router.get('/stats',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('clients', 'read'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;

            const totalClients = await prisma.client.count({
                where: { tenantId }
            });

            const recentClients = await prisma.client.count({
                where: {
                    tenantId,
                    createdAt: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                    }
                }
            });

            res.json({
                success: true,
                stats: {
                    total: totalClients,
                    recent: recentClients
                }
            });
        } catch (error) {
            console.error('Error fetching client stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch statistics'
            });
        }
    }
);

/**
 * POST /api/clients - Create a new client
 */
router.post('/',
    authenticateToken,
    verifyTenantAccess,
    checkSubscriptionAccess,
    checkPermission('clients', 'create'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { name, phone, email, notes, source } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: 'Client name is required'
                });
            }

            const client = await prisma.client.create({
                data: {
                    name,
                    phone,
                    email,
                    notes,
                    source: source || 'Direct',
                    tenantId
                }
            });

            res.status(201).json({
                success: true,
                client,
                message: 'Client created successfully'
            });
        } catch (error) {
            console.error('Error creating client:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create client'
            });
        }
    }
);

/**
 * GET /api/clients/:id - Get a specific client
 */
router.get('/:id',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('clients', 'read'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { id } = req.params;

            const client = await prisma.client.findFirst({
                where: {
                    id,
                    tenantId
                },
                include: {
                    bookings: {
                        orderBy: { date: 'desc' }
                    },
                    minutes: {
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });

            if (!client) {
                return res.status(404).json({
                    success: false,
                    error: 'Client not found'
                });
            }

            res.json({ success: true, client });
        } catch (error) {
            console.error('Error fetching client:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch client'
            });
        }
    }
);

/**
 * PATCH /api/clients/:id - Update a client
 */
router.patch('/:id',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('clients', 'update'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { id } = req.params;
            const { name, phone, email, notes, source } = req.body;

            // Verify client belongs to tenant
            const existingClient = await prisma.client.findFirst({
                where: { id, tenantId }
            });

            if (!existingClient) {
                return res.status(404).json({
                    success: false,
                    error: 'Client not found'
                });
            }

            const updateData = {};
            if (name !== undefined) updateData.name = name;
            if (phone !== undefined) updateData.phone = phone;
            if (email !== undefined) updateData.email = email;
            if (notes !== undefined) updateData.notes = notes;
            if (source !== undefined) updateData.source = source;

            const client = await prisma.client.update({
                where: { id },
                data: updateData
            });

            res.json({
                success: true,
                client,
                message: 'Client updated successfully'
            });
        } catch (error) {
            console.error('Error updating client:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update client'
            });
        }
    }
);

/**
 * DELETE /api/clients/:id - Delete a client
 */
router.delete('/:id',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('clients', 'delete'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { id } = req.params;

            // Verify client belongs to tenant
            const client = await prisma.client.findFirst({
                where: { id, tenantId }
            });

            if (!client) {
                return res.status(404).json({
                    success: false,
                    error: 'Client not found'
                });
            }

            await prisma.client.delete({
                where: { id }
            });

            res.json({
                success: true,
                message: 'Client deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting client:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete client'
            });
        }
    }
);

module.exports = router;
