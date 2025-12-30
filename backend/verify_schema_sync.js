const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function verifySchema() {
    console.log('🔍 Verifying Database Schema Synchronization...');

    try {
        const testEmail = `schema_test_${crypto.randomBytes(4).toString('hex')}@example.com`;

        // 1. Get Role
        const role = await prisma.role.findFirst({ where: { name: 'OWNER' } });
        if (!role) throw new Error('OWNER role not found');
        console.log('✅ Role checked');

        // 2. Transact (Tenant -> User with roleId -> Subscription with type)
        await prisma.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: { name: 'Schema Test Tenant' }
            });
            console.log('✅ Tenant created');

            const user = await tx.user.create({
                data: {
                    email: testEmail,
                    password: 'hashedpassword',
                    name: 'Schema Tester',
                    role: 'OWNER',
                    roleId: role.id, // TESTING THIS FIELD
                    tenantId: tenant.id
                }
            });
            console.log('✅ User created (with roleId)');

            await tx.subscription.create({
                data: {
                    userId: user.id,
                    plan: 'Trial',
                    status: 'Active',
                    type: 'ORGANIZATION' // TESTING THIS FIELD (default exists, but verifying explicit set)
                }
            });
            console.log('✅ Subscription created');

            // Clean up immediately (rollback by throwing)
            throw new Error('ROLLBACK_TEST');
        });

    } catch (e) {
        if (e.message === 'ROLLBACK_TEST') {
            console.log('✅ verification complete (Transaction rolled back successfully)');
        } else {
            console.error('❌ Schema Verification FAILED:', e);
            console.error('⚠️ Suggestion: You probably need to run "npx prisma migrate deploy" or "npx prisma db push"');
        }
    } finally {
        await prisma.$disconnect();
    }
}

verifySchema();
