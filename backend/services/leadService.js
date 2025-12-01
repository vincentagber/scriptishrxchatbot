const supabase = require('./supabaseClient');

const leadService = {
    async captureLead(data) {
        // Insert lead into Supabase 'leads' table
        const { error } = await supabase.from('leads').insert([data]);
        if (error) {
            console.error('❗ Failed to capture lead:', error);
            return false;
        }
        console.log('✅ Lead captured and stored in Supabase');
        return true;
    },

    checkLeadTrigger(userMessage) {
        const lowerMsg = userMessage.toLowerCase();
        const triggers = ['consultation', 'help', 'premium', 'book', 'schedule'];

        if (triggers.some(t => lowerMsg.includes(t))) {
            return {
                isLeadTrigger: true,
                response: "I'd be happy to arrange a consultation or premium service for you. Could you please provide your Name and Email so we can follow up?"
            };
        }

        return { isLeadTrigger: false };
    }
};

module.exports = leadService;
