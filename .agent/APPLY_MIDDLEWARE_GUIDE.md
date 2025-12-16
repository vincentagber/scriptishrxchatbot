# APPLYING MIDDLEWARE TO EXISTING ROUTES
**Guide for securing routes with subscription and permission checks**

---

## MIDDLEWARE OVERVIEW

### 1. Authentication (`auth.js`)
```javascript
const { authenticateToken } = require('../middleware/auth');
```
- **Purpose:** Verifies JWT token, extracts user info
- **Sets:** `req.user` with `userId`, `email`, `role`, `tenantId`
- **Use on:** ALL protected routes

### 2. Subscription (`subscription.js`)
```javascript
const { checkSubscriptionAccess, checkFeature } = require('../middleware/subscription');
```
- **checkSubscriptionAccess:** Verifies active subscription/trial
- **checkFeature(name):** Gates specific features by plan
- **Use on:** Premium/paid features

### 3. Permissions (`permissions.js`)
```javascript
const { 
    checkPermission, 
    requireRole, 
    requireSuperAdmin,
    requireOwnerOrAdmin,
    verifyTenantAccess 
} = require('../middleware/permissions');
```
- **checkPermission(resource, action):** Fine-grained access control
- **requireRole(...roles):** Require specific role(s)
- **verifyTenantAccess:** Enforce tenant isolation

---

## ROUTE-BY-ROUTE APPLICATION GUIDE

### `/api/clients` - Client Management

```javascript
// backend/src/routes/clients.js

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { checkPermission, verifyTenantAccess } = require('../middleware/permissions');
const { checkSubscriptionAccess } = require('../middleware/subscription');

// LIST clients
router.get('/',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('clients', 'read'),
    async (req, res) => {
        // Use req.scopedTenantId for filtering
        const tenantId = req.scopedTenantId;
        const clients = await prisma.client.findMany({
            where: { tenantId }
        });
        res.json({ success: true, clients });
    }
);

// CREATE client
router.post('/',
    authenticateToken,
    verifyTenantAccess,
    checkSubscriptionAccess, // Trial or paid
    checkPermission('clients', 'create'),
    async (req, res) => {
        const tenantId = req.scopedTenantId;
        // ... create logic
    }
);

// UPDATE client
router.patch('/:id',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('clients', 'update'),
    async (req, res) => {
        const tenantId = req.scopedTenantId;
        // Verify client belongs to tenant
        const client = await prisma.client.findFirst({
            where: { id: req.params.id, tenantId }
        });
        if (!client) return res.status(404).json({ error: 'Not found' });
        // ... update logic
    }
);

// DELETE client
router.delete('/:id',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('clients', 'delete'),
    async (req, res) => {
        // ... delete logic
    }
);
```

---

### `/api/bookings` - Booking Management

```javascript
// backend/src/routes/bookings.js

router.get('/',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('bookings', 'read'),
    async (req, res) => {
        // ... list bookings
    }
);

router.post('/',
    authenticateToken,
    verifyTenantAccess,
    checkSubscriptionAccess,
    checkPermission('bookings', 'create'),
    async (req, res) => {
        // ... create booking
    }
);
```

---

### `/api/voice` - Voice Agent Features

```javascript
// backend/src/routes/voice.js

const { checkFeature } = require('../middleware/subscription');

router.post('/outbound',
    authenticateToken,
    verifyTenantAccess,
    checkSubscriptionAccess,
    checkFeature('voice_agent'), // ← Feature-specific
    checkPermission('voice_agents', 'configure'),
    async (req, res) => {
        // ... initiate call
    }
);

router.get('/history',
    authenticateToken,
    verifyTenantAccess,
    checkFeature('voice_agent'),
    checkPermission('voice_agents', 'read'),
    async (req, res) => {
        // ... fetch call history
    }
);
```

---

### `/api/chat` - AI Chat

```javascript
// backend/src/routes/chat.routes.js

router.post('/message',
    authenticateToken,
    verifyTenantAccess,
    checkSubscriptionAccess,
    checkPermission('chatbots', 'read'),
    async (req, res) => {
        // Basic chat is available on all plans
    }
);

router.post('/train',
    authenticateToken,
    verifyTenantAccess,
    checkFeature('custom_branding'), // Training requires higher tier
    checkPermission('chatbots', 'train'),
    async (req, res) => {
        // ... train chatbot
    }
);
```

---

### `/api/insights` - Analytics

```javascript
// backend/src/routes/insights.js

router.get('/analytics',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('analytics', 'read'),
    async (req, res) => {
        // Basic analytics for all
    }
);

router.get('/advanced',
    authenticateToken,
    verifyTenantAccess,
    checkFeature('advanced_analytics'),
    checkPermission('analytics', 'read'),
    async (req, res) => {
        // Advanced analytics (Advanced plan only)
    }
);
```

---

### `/api/settings` - Organization Settings

```javascript
// backend/src/routes/settings.js

const { requireOwnerOrAdmin } = require('../middleware/permissions');

router.get('/',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('settings', 'read'),
    async (req, res) => {
        // Anyone can view settings
    }
);

router.patch('/',
    authenticateToken,
    verifyTenantAccess,
    requireOwnerOrAdmin, // Only Owner/Admin can modify
    checkPermission('settings', 'update'),
    async (req, res) => {
        // ... update settings
    }
);

router.patch('/subscription',
    authenticateToken,
    verifyTenantAccess,
    requireRole('OWNER'), // Only Owner can change subscription
    async (req, res) => {
        // ... update subscription
    }
);
```

---

### `/api/workflows` - Automation

```javascript
// backend/src/routes/workflows.js

router.post('/',
    authenticateToken,
    verifyTenantAccess,
    checkSubscriptionAccess,
    checkFeature('workflow_automation'),
    checkPermission('workflows', 'create'),
    async (req, res) => {
        // Workflow automation (Advanced plan only)
    }
);
```

---

## SUPER ADMIN ROUTES

Create new file `/backend/src/routes/admin.js`:

```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/permissions');
const prisma = require('../lib/prisma');

// ALL admin routes require super admin
router.use(authenticateToken, requireSuperAdmin);

// List all organizations
router.get('/organizations', async (req, res) => {
    const tenants = await prisma.tenant.findMany({
        include: {
            _count: {
                select: {
                    users: true,
                    clients: true
                }
            }
        }
    });
    res.json({ success: true, organizations: tenants });
});

// Get organization details
router.get('/organizations/:tenantId', async (req, res) => {
    const tenant = await prisma.tenant.findUnique({
        where: { id: req.params.tenantId },
        include: {
            users: true,
            clients: true,
            bookings: true
        }
    });
    res.json({ success: true, organization: tenant });
});

// Suspend organization
router.post('/organizations/:tenantId/suspend', async (req, res) => {
    await prisma.tenant.update({
        where: { id: req.params.tenantId },
        data: { plan: 'Suspended' }
    });
    res.json({ success: true, message: 'Organization suspended' });
});

// Platform analytics
router.get('/analytics', async (req, res) => {
    const stats = {
        totalOrgs: await prisma.tenant.count(),
        totalUsers: await prisma.user.count(),
        activeSubscriptions: await prisma.subscription.count({
            where: { status: 'Active' }
        }),
        trialUsers: await prisma.subscription.count({
            where: { plan: 'Trial', status: 'Active' }
        })
    };
    res.json({ success: true, stats });
});

module.exports = router;
```

Register in `app.js`:
```javascript
const adminRouter = require('./routes/admin');
app.use('/api/admin', adminRouter);
```

---

## CHECKLIST: ROUTES TO UPDATE

### High Priority (User-Facing)
- [ ] `/api/clients` - Add permissions + tenant isolation
- [ ] `/api/bookings` - Add permissions + subscription check
- [ ] `/api/minutes` - Add permissions
- [ ] `/api/voice` - Add feature gating + permissions
- [ ] `/api/chat` - Add subscription check
- [ ] `/api/settings` - Add owner/admin restriction

### Medium Priority (Management)
- [ ] `/api/workflows` - Add feature gating
- [ ] `/api/insights` - Add advanced analytics gating
- [ ] `/api/marketing` - Add permissions
- [ ] `/api/notifications` - Add permissions

### Low Priority (Already Open/Public)
- [ ] `/api/auth` - No changes needed
- [ ] `/api/upload` - Already has auth
- [ ] `/webhooks` - External, keep as is

### New Routes
- [ ] `/api/admin` - Create super admin routes
- [ ] `/api/organization` - Already created ✅

---

## TESTING EACH ROUTE

### Test Script Template
```javascript
// test_route_security.js
const axios = require('axios');

const API_URL = 'http://localhost:5000';

async function testRoute(token, method, path, data = {}) {
    try {
        const response = await axios({
            method,
            url: `${API_URL}${path}`,
            headers: { Authorization: `Bearer ${token}` },
            data
        });
        console.log('✅', method, path, '→', response.status);
        return response.data;
    } catch (error) {
        console.log('❌', method, path, '→', error.response?.status, error.response?.data?.error);
        return error.response?.data;
    }
}

async function runTests() {
    // Test without token
    await testRoute(null, 'GET', '/api/clients'); // Should fail 401

    // Test with member token (limited access)
    const memberToken = 'eyJ...'; // From login
    await testRoute(memberToken, 'DELETE', '/api/clients/123'); // Should fail 403

    // Test with owner token
    const ownerToken = 'eyJ...';
    await testRoute(ownerToken, 'DELETE', '/api/clients/123'); // Should succeed

    // Test expired trial
    const expiredTrialToken = 'eyJ...';
    await testRoute(expiredTrialToken, 'POST', '/api/voice/outbound'); // Should fail 403 trial_expired
}

runTests();
```

---

## GRADUAL ROLLOUT STRATEGY

### Phase 1: Core Routes (Week 1)
1. `/api/clients`
2. `/api/bookings`
3. `/api/settings`

### Phase 2: Premium Features (Week 2)
1. `/api/voice`
2. `/api/workflows`
3. `/api/insights`

### Phase 3: Admin & Organization (Week 3)
1. `/api/organization` (already done ✅)
2. `/api/admin` (new)

---

## COMMON PATTERNS

### Reading Organization Data
```javascript
router.get('/',
    authenticateToken,
    verifyTenantAccess, // Sets req.scopedTenantId
    checkPermission('resource', 'read'),
    async (req, res) => {
        const data = await prisma.resource.findMany({
            where: { tenantId: req.scopedTenantId }
        });
        res.json({ success: true, data });
    }
);
```

### Creating Organization Data
```javascript
router.post('/',
    authenticateToken,
    verifyTenantAccess,
    checkSubscriptionAccess, // Check active subscription
    checkPermission('resource', 'create'),
    async (req, res) => {
        const newItem = await prisma.resource.create({
            data: {
                ...req.body,
                tenantId: req.scopedTenantId
            }
        });
        res.json({ success: true, item: newItem });
    }
);
```

### Premium Feature Access
```javascript
router.post('/advanced-feature',
    authenticateToken,
    verifyTenantAccess,
    checkSubscriptionAccess,
    checkFeature('advanced_feature_name'),
    checkPermission('resource', 'action'),
    async (req, res) => {
        // Feature is unlocked
    }
);
```

---

## DEPLOYMENT NOTES

1. **Deploy middleware first** - Ensure no breaking changes
2. **Test in development** - All routes with different roles
3. **Gradual rollout** - One route group at a time
4. **Monitor logs** - Watch for permission failures
5. **Document changes** - Update API docs

---

**Next Steps:**
1. Choose one route file to start with (e.g., `clients.js`)
2. Apply middleware following patterns above
3. Test with different user roles
4. Move to next route file

