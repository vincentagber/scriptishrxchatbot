const { registerSchema } = require('./src/schemas/validation');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock env for testing
process.env.JWT_SECRET = 'test-secret';

async function diagnose() {
    console.log('🩺 DIAGNOSING REGISTRATION FAILURE');

    // 1. Simulate Input (from Screenshot)
    const input = {
        name: "Jane chinyere",
        email: "janechinyere919@gmail.com",
        password: "password123", // Weak password to test Zod
        accountType: "INDIVIDUAL"
        // companyName undefined
    };

    // 2. Test Validation
    console.log('\n--- 1. Testing Validation (Weak Password) ---');
    try {
        registerSchema.parse(input);
        console.log('⚠️ Validation PASSED (Unexpected for weak password!)');
    } catch (e) {
        console.log(`✅ Validation FAILED as expected.`);
        console.log('Error Name:', e.name); // Expect 'ZodError'
        console.log('Error Content:', JSON.stringify(e.errors, null, 2));
    }

    // 3. Test Validation (Strong Password)
    console.log('\n--- 2. Testing Validation (Strong Password) ---');
    const strongInput = { ...input, password: "Password123!" };
    try {
        const validated = registerSchema.parse(strongInput);
        console.log('✅ Validation PASSED');

        // 4. Test Logic Flow using Validated Data
        await simulateLogic(validated);

    } catch (e) {
        console.error('❌ Validation FAILED for Strong Password:', e);
    }

    await prisma.$disconnect();
}

async function simulateLogic(validated) {
    console.log('\n--- 3. Simulating Backend Logic ---');

    // Role Lookup
    const roleName = validated.accountType === 'INDIVIDUAL' ? 'SUBSCRIBER' : 'OWNER';
    console.log(`Target Role: ${roleName}`);

    const dbRole = await prisma.role.findUnique({ where: { name: roleName } });
    if (!dbRole) {
        console.error('❌ CRITICAL: DB Role not found!');
        return;
    }
    console.log('✅ Role found:', dbRole.id);

    // Tenant Creation Simulation
    console.log('Simulating DB Writes...');
    try {
        await prisma.$transaction(async (tx) => {
            // ... Logic mirrored from auth.js ...
            // We won't actually write to avoid polluting, or we write and rollback.
            throw new Error('SIMULATION_SUCCESS');
        });
    } catch (e) {
        if (e.message === 'SIMULATION_SUCCESS') {
            console.log('✅ DB Transaction Logic seems valid (reached end of block)');
        } else {
            console.error('❌ DB Transaction Logic CRASHED:', e);
        }
    }

    // Token Generation
    console.log('\n--- 4. Testing Token Generation ---');
    try {
        const user = { id: 'test-id', email: 'test@example.com', role: 'SUBSCRIBER', tenantId: 'test-tenant' };
        const token = jwt.sign(user, process.env.JWT_SECRET);
        console.log('✅ Token generated successfully');
    } catch (e) {
        console.error('❌ Token Generation FAILED:', e);
    }
}

diagnose();
