const express = require('express');
const router = express.Router();
const clientService = require('../services/clientService');
const authMiddleware = require('../lib/authMiddleware');
const { createClientSchema } = require('../schemas/validation');

router.use(authMiddleware);

// GET /api/clients
router.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        const clients = await clientService.getClients(req.user.tenantId, search);
        res.json(clients);
    } catch (error) {
        console.error('Fetch clients error:', error);
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});

// GET /api/clients/stats
router.get('/stats', async (req, res) => {
    try {
        const stats = await clientService.getClientStats(req.user.tenantId);
        res.json(stats);
    } catch (error) {
        console.error('Fetch stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// POST /api/clients
router.post('/', async (req, res) => {
    try {
        const validated = createClientSchema.parse(req.body);
        const client = await clientService.createClient(req.user.tenantId, validated);
        res.status(201).json(client);
    } catch (error) {
        if (error.name === 'ZodError') return res.status(400).json({ error: error.errors });
        console.error('Create client error:', error);
        res.status(500).json({ error: 'Failed to create client' });
    }
});

// PUT /api/clients/:id
router.put('/:id', async (req, res) => {
    try {
        const validated = createClientSchema.parse(req.body);
        const client = await clientService.updateClient(req.user.tenantId, req.params.id, validated);
        res.json(client);
    } catch (error) {
        if (error.name === 'ZodError') return res.status(400).json({ error: error.errors });
        if (error.message.startsWith('NOT_FOUND')) return res.status(404).json({ error: 'Client not found' });
        console.error('Update client error:', error);
        res.status(500).json({ error: 'Failed to update client' });
    }
});

// DELETE /api/clients/:id
router.delete('/:id', async (req, res) => {
    try {
        await clientService.deleteClient(req.user.tenantId, req.params.id);
        res.json({ message: 'Client deleted' });
    } catch (error) {
        if (error.message.startsWith('NOT_FOUND')) return res.status(404).json({ error: 'Client not found' });
        console.error('Delete client error:', error);
        res.status(500).json({ error: 'Failed to delete client' });
    }
});

module.exports = router;
