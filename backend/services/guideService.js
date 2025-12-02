const guideService = {
    getRecommendation(userMessage) {
        const lowerMsg = userMessage.toLowerCase();
        const keywords = ['chicago', 'sightseeing', 'visit', 'tour', 'attraction'];

        if (keywords.some(k => lowerMsg.includes(k))) {
            // Provide detailed recommendations for Chicago attractions
            return "Welcome to Chicago! Here are some top sights:\n- Millennium Park: Home to the iconic Cloud Gate sculpture (The Bean) and beautiful gardens. Great for a mindful walk.\n- Navy Pier: Enjoy lakeside views, rides, and dining. Perfect for a relaxing stroll.\n- Art Institute of Chicago: Explore world-class art collections, inspiring creativity and mental wellness.\n- Lakefront Trail: A scenic 18‑mile path ideal for jogging, biking, and stress‑relieving walks along Lake Michigan.\nFeel free to ask for directions or more details about any of these!";
            return "Welcome to Chicago! As a local expert, I highly recommend visiting Millennium Park to see the Bean, taking a stroll on Navy Pier, or exploring the Art Institute of Chicago. For a wellness-focused break, the Lakefront Trail offers amazing views and fresh air.";
        }

        return null;
    }
};

module.exports = guideService;
