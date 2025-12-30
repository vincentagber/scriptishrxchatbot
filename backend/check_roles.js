const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRoles() {
    try {
        const roles = await prisma.role.findMany();
        console.log(`Found ${roles.length} roles.`);
        roles.forEach(r => console.log(`- ${r.name}`));

        const ownerRole = roles.find(r => r.name === 'OWNER');
        const subscriberRole = roles.find(r => r.name === 'SUBSCRIBER');

        if (!ownerRole || !subscriberRole) {
            console.error('❌ CRITICAL: Missing required system roles (OWNER or SUBSCRIBER). Registration will fail.');
        } else {
            console.log('✅ Required roles present.');
        }

    } catch (e) {
        console.error('DB Connection Failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

checkRoles();
