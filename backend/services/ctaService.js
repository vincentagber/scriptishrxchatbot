const ctaService = {
    getDirections(userMessage) {
        const lowerMsg = userMessage.toLowerCase();

        if (lowerMsg.includes('ord') || lowerMsg.includes("o'hare")) {
            return "From O'Hare (ORD): Take the Blue Line train towards Forest Park. Transfer to the Green Line at Clark/Lake if you need to reach a specific office location. It's a convenient, eco‑friendly route.";
        }

        if (lowerMsg.includes('mdw') || lowerMsg.includes('midway')) {
            return "From Midway (MDW): Take the Orange Line train towards the Loop. It provides a quick ride into downtown Chicago.";
        }

        if (lowerMsg.includes('airport')) {
            return "Please specify which airport (O'Hare or Midway) you are traveling from for detailed CTA directions.";
        }

        return null;
    }
};

module.exports = ctaService;
