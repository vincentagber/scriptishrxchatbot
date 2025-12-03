const faqs = [
  {
    question: "Services & Pricing",
    answer: "Here’s a simple overview of our main services and their prices:\n\n**Wellness Lounge — $49.99 for 2 hours**\nRelax, enjoy refreshments, use fast WiFi, and charge your devices in a comfortable travel-friendly space.\n\n**Luggage Drop-Off — $4.99 per hour**\nSafe and secure short-term luggage storage so you can explore Chicago hands-free.\n\n**Hourly Workspace — $24.99 per hour**\nA quiet private desk with fast WiFi, charging ports, and a productive work environment.\n\nIf you’d like to book any of these services or need more details, just let me know — I’m here to help!",
    keywords: ['services', 'pricing', 'cost', 'how much', 'lounge', 'luggage', 'workspace', 'storage', 'work']
  },
  {
    question: "Location & Address",
    answer: "Our office is located at 111 N Wabash Ave, Chicago, IL 60602, inside the Garland Building in downtown Chicago.\n\nFor public transit:\n\n- Millennium Station is about a 3-minute walk\n- Washington/Wabash L-station is about a 6-minute walk\n\nIf you’re driving, there are several parking garages nearby. I can also provide walking or transit directions from any location — just let me know!",
    keywords: ['location', 'address', 'where', 'office', 'parking']
  },
  {
    question: "Booking & Contact",
    answer: "To book an appointment, you can email us at info@scriptishrx.com or call +1 (872) 873-2880.\nWe’ll be happy to assist you with scheduling.",
    keywords: ['book', 'appointment', 'consultation', 'contact', 'email', 'phone', 'schedule']
  },
  {
    question: "Training & Courses",
    answer: "At this time, we focus mainly on providing wellness and travel support rather than formal training courses.\nHowever, we do offer:\n\n- Wellness tips\n- Travel guidance\n- Real-time travel advisories\n- Personal wellness consultations\n\nIf you're interested in future workshops or training programs, I’d be happy to note your interest and connect you with a consultant who can provide more information.",
    keywords: ['training', 'course', 'class', 'workshop', 'education']
  },
  {
    question: "Company Overview",
    answer: "Thank you for your interest! At ScriptishRx Wellness and Travel, we provide a range of wellness services designed especially for travelers.\n\nOur main services include:\n\n- A Wellness Lounge where you can relax and recharge\n- Secure luggage drop-off\n- Hourly workspaces for quiet, productive work\n\nThe Wellness Lounge offers refreshments, WiFi, charging stations, and comfortable seating. Our luggage storage is safe and convenient, and our workspaces are fully equipped to keep you productive. If you’d like more details, I’d be happy to help!",
    keywords: ['what do you do', 'about', 'mission', 'scriptishrx', 'who are you']
  },
  {
    question: "Wellness Tips & Guidance",
    answer: "We provide wellness tips and travel guidance to help you stay healthy and informed during your journey. Our team can offer:\n\n- Personal wellness consultations\n- Real-time travel advisories\n- Health and safety recommendations\n- Best practices for travel wellness\n\nIf you need tips tailored to your situation or destination, feel free to ask!",
    keywords: ['wellness tips', 'travel guidance', 'health', 'advice', 'safety']
  },
  {
    question: "Future Programs",
    answer: "While our current focus is wellness and travel support, we’re always exploring new offerings. If you're interested in:\n\n- Wellness workshops\n- Travel safety programs\n- Health awareness sessions\n\nLet me know! I can connect you with a consultant or note your interest for future programs.",
    keywords: ['future', 'program', 'coming soon']
  }
];

const ragService = {
  async query(userMessage) {
    const lowerMsg = userMessage.toLowerCase();

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
