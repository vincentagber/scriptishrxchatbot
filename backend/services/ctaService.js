const ctaService = {
    getDirections(userMessage) {
        const lowerMsg = userMessage.toLowerCase();

        if (lowerMsg.includes('airport') || lowerMsg.includes('ord') || lowerMsg.includes('mdw') || lowerMsg.includes('o\'hare') || lowerMsg.includes('midway')) {
            if (lowerMsg.includes('ord') || lowerMsg.includes('o\'hare')) {
                return "From O'Hare (ORD): Take the Blue Line train towards Forest Park. Transfer to the Green Line at Clark/Lake if heading to our specific office location (assuming it's near a Green Line stop, otherwise adjust). It's a convenient and eco-friendly way to travel.";
            }
            if (lowerMsg.includes('mdw') || lowerMsg.includes('midway')) {
                return "From Midway (MDW): Take the Orange Line train towards the Loop. It offers a quick ride into the city center.";
            }
            return "Are you traveling from O'Hare (ORD) or Midway (MDW)? I can provide specific CTA directions for either.";
        }

        return null;
    }
};

module.exports = ctaService;
