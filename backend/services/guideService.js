const guideService = {
    getRecommendation(userMessage) {
        const lowerMsg = userMessage.toLowerCase();
        const keywords = ['chicago', 'sightseeing', 'visit', 'tour', 'attraction'];

        if (keywords.some(k => lowerMsg.includes(k))) {
            return "Welcome to Chicago! As a local expert, I highly recommend visiting Millennium Park to see the Bean, taking a stroll on Navy Pier, or exploring the Art Institute of Chicago. For a wellness-focused break, the Lakefront Trail offers amazing views and fresh air.";
        }

        return null;
    }
};

module.exports = guideService;
