const ctaService = {
    getDirections(userMessage) {
        const lowerMsg = userMessage.toLowerCase();

        if (lowerMsg.includes('airport') || lowerMsg.includes('ord') || lowerMsg.includes('mdw') || lowerMsg.includes('o\'hare') || lowerMsg.includes('midway')) {
            if (lowerMsg.includes('ord') || lowerMsg.includes('o\'hare')) {
                return "From O'Hare (ORD): Take the Blue Line train from the lower-level concourse towards Forest Park. Ride for about 40-45 minutes and get off at the Washington/Wabash station. From there, it's just a short walk to our office at 111 N Wabash Ave (The Garland Building).";
            }
            if (lowerMsg.includes('mdw') || lowerMsg.includes('midway')) {
                return "From Midway (MDW): Take the Orange Line train from the station just east of the terminals towards the Loop. It's about a 20-25 minute ride. Get off at the Washington/Wabash station, and you'll be just steps away from 111 N Wabash Ave.";
            }
            return "Are you coming from O'Hare (ORD) or Midway (MDW)? I can give you specific train directions to our downtown office for either one!";
        }

        return null;
    }
};

module.exports = ctaService;
