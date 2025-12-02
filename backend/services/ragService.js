const faqs = [
  {
    question: "Wellness Lounge Pricing",
    answer: "Our Wellness Lounge is $49.99 for 2 hours. It includes comfortable seating, complimentary refreshments, and WiFi & charging stations.",
    keywords: ['lounge', 'wellness', 'pricing', 'cost', 'how much']
  },
  {
    question: "Luggage Storage Pricing",
    answer: "Luggage Storage is $4.99 per hour. We offer safe & secure lockers with 24/7 surveillance and easy check-in/out.",
    keywords: ['luggage', 'storage', 'bag', 'pricing', 'cost', 'how much']
  },
  {
    question: "Hourly Workspace Pricing",
    answer: "Our Hourly Workspace is $24.99 per hour. It features a private desk, ergonomic chair, high-speed WiFi, and power outlets.",
    keywords: ['work', 'desk', 'office', 'pricing', 'cost', 'how much']
  },
  {
    question: "WiFi Amenities",
    answer: "Yes, we offer high-speed WiFi in our Wellness Lounge and Hourly Workspaces.",
    keywords: ['wifi', 'internet']
  },
  {
    question: "Mission Statement",
    answer: "ScriptishRx is an AI-powered travel wellness platform. We help you discover amazing destinations, plan wellness routines, find secure luggage storage, and explore fascinating historical insights.",
    keywords: ['mission', 'about', 'what is']
  },
  {
    question: "General Wellness Tips",
    answer: "Here are some travel wellness tips:\n1. Stay Hydrated: Drink plenty of water, especially during flights.\n2. Move Frequently: Stretch your legs every hour to improve circulation.\n3. Adjust Sleep: Start adjusting your sleep schedule a few days before your trip to minimize jet lag.\n4. Healthy Snacking: Pack nutritious snacks like nuts and fruit to avoid unhealthy airport food.",
    keywords: ['wellness', 'tips', 'health', 'advice', 'healthy']
  },
  {
    question: "Jet Lag Advice",
    answer: "To combat jet lag: expose yourself to natural light upon arrival, stay hydrated, avoid heavy meals before bed, and try to adapt to the local time zone immediately.",
    keywords: ['jet lag', 'sleep', 'tired', 'timezone']
  }
];

const ragService = {
  async query(userMessage) {
    const lowerMsg = userMessage.toLowerCase();

    // Simple keyword matching against structured data
    // In a real DB scenario, this would be a vector search or SQL ILIKE query
    const match = faqs.find(faq => {
      // Check if all keywords in a subset match (simplified logic for now)
      // Better: Check if the message contains specific unique keywords for that FAQ
      return faq.keywords.some(keyword => lowerMsg.includes(keyword));
    });

    if (match) {
      // Refine matching for pricing to distinguish between services if multiple match 'pricing'
      if (lowerMsg.includes('pricing') || lowerMsg.includes('cost')) {
        if (lowerMsg.includes('lounge')) return faqs.find(f => f.question === "Wellness Lounge Pricing").answer;
        if (lowerMsg.includes('luggage')) return faqs.find(f => f.question === "Luggage Storage Pricing").answer;
        if (lowerMsg.includes('work')) return faqs.find(f => f.question === "Hourly Workspace Pricing").answer;

        return "Here is our pricing:\n- Luggage Storage: $4.99/hour\n- Wellness Lounge: $49.99/2 hours\n- Hourly Workspace: $24.99/hour";
      }
      return match.answer;
    }

    return null;
  }
};

module.exports = ragService;
