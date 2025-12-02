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

        // Send to Make.com Webhook
        const webhookUrl = process.env.MAKE_WEBHOOK_URL || process.env.PUBLIC_MAKE_WEBHOOK_URL;
        if (webhookUrl && webhookUrl.startsWith('http')) {
            try {
                fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                }).then(res => {
                    if (res.ok) console.log('✅ Lead sent to Make.com');
                    else console.error('❗ Failed to send to Make.com:', res.statusText);
                }).catch(err => console.error('❗ Error sending to Make.com:', err));
            } catch (error) {
                console.error('❗ Error triggering Make.com webhook:', error);
            }
        }

        return true;
    },

    checkLeadTrigger(userMessage) {
        const lowerMsg = userMessage.toLowerCase();
        const triggers = ['consultation', 'help', 'premium', 'book', 'schedule'];

        if (lowerMsg.includes('appointment') || (lowerMsg.includes('book') && lowerMsg.includes('consultation'))) {
            return {
                isLeadTrigger: true,
                response: "For healthcare consultations and appointments, please email us directly at info@scriptishrx.com."
            };
        }

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
