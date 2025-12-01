const express = require('express');
const router = express.Router();
const ragService = require('../services/ragService');
const ctaService = require('../services/ctaService');
const guideService = require('../services/guideService');

const leadService = require('../services/leadService');

router.post('/', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // 0. Check Lead Trigger
        const leadCheck = leadService.checkLeadTrigger(message);
        if (leadCheck.isLeadTrigger) {
            return res.json({ role: 'assistant', content: leadCheck.response });
        }

        // 1. Check CTA (Navigation)
        const ctaResponse = ctaService.getDirections(message);
        if (ctaResponse) {
            return res.json({ role: 'assistant', content: ctaResponse });
        }

        // 2. Check Chicago Guide
        const guideResponse = guideService.getRecommendation(message);
        if (guideResponse) {
            return res.json({ role: 'assistant', content: guideResponse });
        }

        // 3. Check RAG (Knowledge Base)
        const ragResponse = await ragService.query(message);
        if (ragResponse) {
            return res.json({ role: 'assistant', content: ragResponse });
        }

        // 4. Lead Capture Trigger
        return res.json({
            role: 'assistant',
            content: "I'm here to help with ScriptishRx services, Chicago travel, or wellness. Could you please provide more details or ask about our pricing, location, or sightseeing?"
        });

    } catch (error) {
        console.error('Error in chat route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
