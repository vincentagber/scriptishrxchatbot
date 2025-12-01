const express = require('express');
const router = express.Router();
const leadService = require('../services/leadService');

router.post('/', async (req, res) => {
    try {
        const { name, email, phone } = req.body;

        if (!name || !email || !phone) {
            return res.status(400).json({ error: 'Name, email, and phone are required' });
        }

        const success = await leadService.captureLead({ name, email, phone });

        if (success) {
            return res.status(201).json({ message: 'Lead captured successfully' });
        } else {
            return res.status(500).json({ error: 'Failed to capture lead' });
        }
    } catch (error) {
        console.error('Error in leads route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
