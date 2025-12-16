# 🚀 QUICK START GUIDE - NEXT SESSION

## 📍 WHERE WE LEFT OFF

**Status:** 6/8 critical issues resolved (75% complete)  
**Database:** ✅ Migrated and ready  
**Super Admin:** ✅ Created (`admin@scriptishrx.com`)  
**Next Priority:** Apply security middleware to routes

---

## ⚡ IMMEDIATE NEXT STEPS (IN ORDER)

### 1. Test Current Fixes (15 minutes)

Start the application:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

**Quick Tests:**
- [ ] Navigate to http://localhost:3000
- [ ] Register a new account → Should get 14-day trial
- [ ] Check chat → Messages should be in correct order
- [ ] Try customizing chatbot prompt in settings

---

### 2. Apply Middleware to /api/clients (30 minutes)

**File:** `/backend/src/routes/clients.js`

```javascript
// Add at top
const { authenticateToken } = require('../middleware/auth');
const { checkPermission, verifyTenantAccess } = require('../middleware/permissions');
const { checkSubscriptionAccess } = require('../middleware/subscription');

// Update each route:
router.get('/',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('clients', 'read'),
    async (req, res) => {
        // Change filterto use req.scopedTenantId
        const clients = await prisma.client.findMany({
            where: { tenantId: req.scopedTenantId }
        });
        res.json({ success: true, clients });
    }
);

// Repeat for POST, PATCH, DELETE
```

**Test:**
```bash
# Create test user with MEMBER role (via invite)
# Try to delete a client → Should get 403 Permission Denied
# Login as OWNER → Should succeed
```

---

### 3. Apply to /api/bookings (20 minutes)

Follow same pattern as clients:
- Add imports
- Add middleware to each route
- Use `req.scopedTenantId` for filtering

---

### 4. Apply to /api/voice (30 minutes)

**Important:** Add feature gating

```javascript
const { checkFeature } = require('../middleware/subscription');

router.post('/outbound',
    authenticateToken,
    verifyTenantAccess,
    checkSubscriptionAccess,
    checkFeature('voice_agent'), // ← Feature-specific
    checkPermission('voice_agents', 'configure'),
    async (req, res) => {
        // ...
    }
);
```

---

### 5. Test Invite System (15 minutes)

```bash
# 1. Login as a created OWNER
# 2. Navigate to: POST /api/organization/invite
curl -X POST http://localhost:5000/api/organization/invite \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newteam@example.com",
    "role": "MANAGER"
  }'

# 3. Copy the invite token from response
# 4. Register using that token
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newteam@example.com",
    "password": "password123",
    "name": "New Team Member",
    "inviteToken": "TOKEN_FROM_STEP_2"
  }'

# 5. Verify new user is in same organization with MANAGER role
```

---

### 6. Fix Voice Provider (2-3 hours)

**Files to Review:**
- `/backend/src/services/voiceCakeService.js`
- `/backend/src/services/voiceService.js`
- `/backend/src/routes/voicecake.js`
- `/backend/src/routes/voice.js`

**Goal:** Consolidate to use Twilio as single source of truth

**Steps:**
1. Audit which service handles TTS/STT
2. Map Twilio integration points
3. Update voice routing logic
4. Remove/disable conflicting providers
5. Test inbound and outbound calls

---

## 📚 REFERENCE DOCS

All documentation is in `/.agent/`:

| File | Purpose |
|------|---------|
| `SESSION_COMPLETION_REPORT.md` | Full status report (what was done) |
| `AUDIT_AND_REMEDIATION_PLAN.md` | Original audit findings |
| `IMPLEMENTATION_SUMMARY.md` | Technical implementation details |
| `APPLY_MIDDLEWARE_GUIDE.md` | **START HERE** - Route security guide |

---

## 🧪 TESTING AS YOU GO

After each route update:

```javascript
// test_security.js
const axios = require('axios');

const API_URL = 'http://localhost:5000';

// Test cases
async function test() {
    // 1. No auth → Should fail 401
    try {
        await axios.get(`${API_URL}/api/clients`);
        console.log('❌ SECURITY BUG: Route allowed without auth!');
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ Auth required');
        }
    }

    // 2. Wrong role → Should fail 403
    const memberToken = 'eyJ...'; // Login as MEMBER
    try {
        await axios.delete(`${API_URL}/api/clients/123`, {
            headers: { Authorization: `Bearer ${memberToken}` }
        });
        console.log('❌ PERMISSION BUG: MEMBER deleted client!');
    } catch (error) {
        if (error.response?.status === 403) {
            console.log('✅ Permission denied correctly');
        }
    }

    // 3. Correct role → Should succeed
    const ownerToken = 'eyJ...'; // Login as OWNER
    const response = await axios.get(`${API_URL}/api/clients`, {
        headers: { Authorization: `Bearer ${ownerToken}` }
    });
    console.log('✅ Owner can access clients:', response.data);
}

test();
```

---

## 🎯 GOALS FOR THIS SESSION

**Minimum:**
- [ ] Apply middleware to `/api/clients`, `/api/bookings`, `/api/voice`
- [ ] Test invite system end-to-end
- [ ] Verify trial expiry works

**Ideal:**
- [ ] All routes have middleware
- [ ] Voice provider consolidated
- [ ] Frontend updated for invites
- [ ] Email service configured

**Stretch:**
- [ ] Super admin routes created
- [ ] Team management UI built
- [ ] Automated tests started

---

## 🚨 COMMON ISSUES & FIXES

### "Cannot find module '../middleware/subscription'"
```bash
# Ensure files were created:
ls backend/src/middleware/
# Should see: auth.js, permissions.js, subscription.js
```

### "Table 'Invite' does not exist"
```bash
cd backend
npx prisma db push
npx prisma generate
```

### "Permission denied" for everything
```bash
# Check user role:
# Login → Copy token → Decode at jwt.io
# Ensure role field is present in JWT payload
```

### Email invites not sending
```
# Expected! Email service not configured yet.
# For now, copy invite link from API response
# Configure SendGrid later
```

---

## 💡 PRO TIPS

1. **Use Postman/Thunder Client**
   - Save your auth tokens
   - Create request collections for testing
   - Test different user roles easily

2. **Check Logs**
   - Backend logs show middleware execution
   - Look for: "Permission denied", "Subscription expired", etc.

3. **Test Tenant Isolation**
   - Create 2 orgs, try to access data from wrong org
   - Should always get 403 or empty results

4. **Use Super Admin Wisely**
   - Only for platform management
   - Don't use for daily development
   - Create regular test users

---

## 📞 NEED HELP?

1. Review `/.agent/APPLY_MIDDLEWARE_GUIDE.md` for detailed examples
2. Check`/.agent/SESSION_COMPLETION_REPORT.md` for full context
3. Look at `/backend/src/routes/organization.js` as reference implementation

---

## ✅ SESSION COMPLETION CHECKLIST

When you're done, check these off:

- [ ] At least 3 route files have middleware applied
- [ ] Tested with different user roles (OWNER, ADMIN, MEMBER)
- [ ] Verified tenant isolation (user A can't access org B)
- [ ] Tested trial expiry (manually or by mocking date)
- [ ] Invite system tested successfully
- [ ] Documentation updated if needed
- [ ] Git committed with descriptive message

---

**🎯 Focus:** Security first. Apply middleware methodically. Test thoroughly.  
**🕐 Time Estimate:** 4-6 hours for full route security  
**⚡ Quick Win:** Start with `/api/clients` - only 4 routes to secure

**Good luck! 🚀**
