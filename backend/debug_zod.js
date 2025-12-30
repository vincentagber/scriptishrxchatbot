const { registerSchema } = require('./src/schemas/validation');

async function checkZod() {
    try {
        registerSchema.parse({ password: 'weak' });
    } catch (e) {
        console.log('Error Keys:', Object.keys(e));
        console.log('e.issues:', e.issues);
        console.log('e.errors:', e.errors);
        console.log('e.message:', e.message);
    }
}
checkZod();
