const faqs = [
  {
    question: "Wellness Lounge Pricing",
    answer: "Our Wellness Lounge is the perfect place to relax and recharge! It's $49.99 for a 2-hour pass. This includes access to comfortable seating, complimentary refreshments, high-speed WiFi, and charging stations for all your devices. Would you like to book a spot?",
    keywords: ['lounge', 'wellness', 'pricing', 'cost', 'how much', 'relax']
  },
  {
    question: "Luggage Storage Pricing",
    answer: "Need to lighten your load? Our Luggage Drop Off service is safe and secure for just $4.99 per hour per bag. It's a great way to explore the city burden-free!",
    keywords: ['luggage', 'storage', 'bag', 'pricing', 'cost', 'how much', 'drop off']
  },
  {
    question: "Hourly Workspace Pricing",
    answer: "Looking for a quiet place to be productive? Our Hourly Workspace is available for $24.99 per hour. You'll get a private desk, fast WiFi, and plenty of power outlets to keep you going.",
    keywords: ['work', 'desk', 'office', 'pricing', 'cost', 'how much', 'workspace']
  },
  {
    question: "Shower Suites Pricing",
    answer: "Freshen up with our Shower Suites for $24.99 per session. We provide premium toiletries, fluffy towels, and a private space for you to get ready for your next adventure.",
    keywords: ['shower', 'suite', 'pricing', 'cost', 'how much', 'clean']
  },
  {
    question: "Booking & Contact",
    answer: "I'd be happy to help you with that! To book an appointment or consultation, you can email us directly at info@scriptishrx.com or give us a call at +1 (872) 873-2880. We'll get you scheduled right away!",
    keywords: ['book', 'appointment', 'consultation', 'contact', 'email', 'phone', 'schedule']
  },
  {
    question: "Location & Address",
    answer: "We are located in the heart of downtown Chicago at 111 N Wabash Ave, Chicago, IL 60602, inside The Garland Building. It's a convenient spot near Millennium Park!",
    keywords: ['location', 'address', 'where', 'located', 'find']
  },
  {
    question: "Mission & Training",
    answer: "At ScriptishRx Wellness and Travel, our mission is to support travelers with wellness tips, guidance, and a physical space to relax. While we don't offer formal training courses at this time, we do provide personal wellness consultations and real-time travel advisories. If you're interested in future workshops on wellness or travel safety, let me know, and I can have a consultant reach out!",
    keywords: ['mission', 'about', 'training', 'course', 'education', 'workshop', 'class']
  },
  {
    question: "General Wellness Tips",
    answer: "Staying healthy while traveling is key! Based on our travel wellness guide, here are a few tips:\n1. **Pack a Wellness Kit**: Include pain relievers, digestive aids, and any personal meds.\n2. **Stay Hydrated**: Drink plenty of water, especially on flights.\n3. **Move Often**: Stretch your legs every hour to keep circulation flowing.\n4. **Mindfulness**: Take a few minutes to breathe and ground yourself if travel gets stressful.\nWould you like more specific advice on packing or jet lag?",
    keywords: ['wellness', 'tips', 'health', 'advice', 'healthy', 'kit', 'pack']
  },
  {
    question: "Workspace Wellness",
    answer: "Creating a healthy workspace is so important! Here are some tips from our blog:\n- **Ergonomics**: Ensure your screen is at eye level and your chair supports your back.\n- **Lighting**: Natural light is best, but if that's not possible, try to avoid harsh glare.\n- **Digital Boundaries**: Use blue light filters and try to set specific times for checking notifications to reduce stress.\nWe also offer comfortable Hourly Workspaces if you need a change of scenery!",
    keywords: ['workspace', 'work', 'ergonomics', 'lighting', 'digital', 'office', 'productivity']
  },
  {
    question: "Travel Health & Insurance",
    answer: "Preparing for the unexpected is smart. We recommend:\n- **Travel Insurance**: It's a safety net for medical emergencies or cancellations.\n- **Local Healthcare**: Know where the nearest clinic or hospital is at your destination.\n- **Wellness Preferences**: You can set your wellness preferences with us to get personalized advice!\nSafe travels are happy travels!",
    keywords: ['insurance', 'safety', 'medical', 'emergency', 'healthcare', 'prepare']
  }
];

const ragService = {
  async query(userMessage) {
    const lowerMsg = userMessage.toLowerCase();

    // Check for specific service pricing queries first
    if (lowerMsg.includes('price') || lowerMsg.includes('cost') || lowerMsg.includes('how much')) {
      if (lowerMsg.includes('lounge')) return faqs.find(f => f.question === 'Wellness Lounge Pricing').answer;
      if (lowerMsg.includes('luggage') || lowerMsg.includes('bag') || lowerMsg.includes('storage')) return faqs.find(f => f.question === 'Luggage Storage Pricing').answer;
      if (lowerMsg.includes('work') || lowerMsg.includes('desk')) return faqs.find(f => f.question === 'Hourly Workspace Pricing').answer;
      if (lowerMsg.includes('shower')) return faqs.find(f => f.question === 'Shower Suites Pricing').answer;
    }

    // Check for advice/tips queries
    if (lowerMsg.includes('tip') || lowerMsg.includes('advice') || lowerMsg.includes('healthy') || lowerMsg.includes('wellness')) {
      if (lowerMsg.includes('work') || lowerMsg.includes('office') || lowerMsg.includes('ergonomics')) return faqs.find(f => f.question === 'Workspace Wellness').answer;
      if (lowerMsg.includes('travel') || lowerMsg.includes('trip')) return faqs.find(f => f.question === 'Travel Health & Insurance').answer;
    }

    // General keyword matching
    for (const faq of faqs) {
      if (faq.keywords.some(keyword => lowerMsg.includes(keyword))) {
        return faq.answer;
      }
    }

    return null;
  }
};

module.exports = ragService;
