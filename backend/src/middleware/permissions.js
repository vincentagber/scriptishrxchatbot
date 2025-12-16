// backend/src/middleware/permissions.js
/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Implements granular permissions for:
 * - SUPER_ADMIN: Platform-wide access
 * - OWNER: Full organization access
 * - ADMIN: Organization management (no billing)
 * - MANAGER: CRM + Analytics
 * - MEMBER: Limited CRM access
 */

const prisma = require('../lib/prisma');

// ========== PERMISSION MATRIX ==========
const PERMISSIONS = {
    // Super Admin - Platform Management
    'SUPER_ADMIN': {
        'platform': ['*'], // All actions
        'organizations': ['create', 'read', 'update', 'delete', 'suspend'],
        'users': ['create', 'read', 'update', 'delete'],
        'subscriptions': ['create', 'read', 'update', 'delete', 'override'],
        'analytics': ['platform_wide'],
        'settings': ['system']
    },

    // Owner - Full Organization Access
    'OWNER': {
        'organization': ['read', 'update', 'delete'],
        'users': ['create', 'read', 'update', 'delete', 'invite'],
        'clients': ['create', 'read', 'update', 'delete'],
        'bookings': ['create', 'read', 'update', 'delete'],
        'minutes': ['create', 'read', 'update', 'delete'],
        'voice_agents': ['create', 'read', 'update', 'delete', 'configure'],
        'chatbots': ['create', 'read', 'update', 'delete', 'train'],
        'workflows': ['create', 'read', 'update', 'delete'],
        'campaigns': ['create', 'read', 'update', 'delete'],
        'analytics': ['read'],
        'subscriptions': ['read', 'update'],
        'settings': ['read', 'update'],
        'integrations': ['create', 'read', 'update', 'delete']
    },

    // Admin - Organization Management (no billing)
    'ADMIN': {
        'organization': ['read', 'update'],
        'users': ['create', 'read', 'update', 'invite'],
        'clients': ['create', 'read', 'update', 'delete'],
        'bookings': ['create', 'read', 'update', 'delete'],
        'minutes': ['create', 'read', 'update', 'delete'],
        'voice_agents': ['read', 'update', 'configure'],
        'chatbots': ['read', 'update', 'train'],
        'workflows': ['create', 'read', 'update'],
        'campaigns': ['create', 'read', 'update'],
        'analytics': ['read'],
        'settings': ['read'],
        'integrations': ['read', 'update']
    },

    // Manager - CRM + Analytics + Voice
    'MANAGER': {
        'clients': ['create', 'read', 'update'],
        'bookings': ['create', 'read', 'update'],
        'minutes': ['create', 'read', 'update'],
        'voice_agents': ['read', 'configure'],
        'chatbots': ['read'],
        'analytics': ['read'],
        'campaigns': ['read']
    },

    // Member - Basic CRM Access
    'MEMBER': {
        'clients': ['read', 'update'],
        'bookings': ['read', 'update'],
        'minutes': ['read'],
        'chatbots': ['read']
    }
};

/**
 * Check if user has permission for action on resource
 */
function checkPermission(resource, action) {
    return async (req, res, next) => {
        try {
            const userRole = req.user?.role;
            const userId = req.user?.userId || req.user?.id;
            const tenantId = req.user?.tenantId;

            if (!userRole) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required',
                    code: 'NO_ROLE'
                });
            }

            // Get user permissions for their role
            const rolePermissions = PERMISSIONS[userRole];

            if (!rolePermissions) {
                return res.status(403).json({
                    success: false,
                    error: 'Invalid role',
                    code: 'INVALID_ROLE'
                });
            }

            // Check if role has access to resource
            const resourcePermissions = rolePermissions[resource];

            if (!resourcePermissions) {
                return res.status(403).json({
                    success: false,
                    error: `Access denied to ${resource}`,
                    code: 'NO_RESOURCE_ACCESS',
                    resource,
                    role: userRole
                });
            }

            // Check if action is allowed
            const hasPermission = resourcePermissions.includes('*') || resourcePermissions.includes(action);

            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    error: `Cannot ${action} ${resource}`,
                    code: 'NO_ACTION_PERMISSION',
                    resource,
                    action,
                    role: userRole,
                    message: `Your role (${userRole}) does not have permission to ${action} ${resource}`
                });
            }

            // For non-super-admins, verify tenant isolation
            if (userRole !== 'SUPER_ADMIN' && tenantId) {
                req.scopedTenantId = tenantId; // Enforce tenant scoping
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            return res.status(500).json({
                success: false,
                error: 'Permission verification failed',
                code: 'PERMISSION_CHECK_ERROR'
            });
        }
    };
}

/**
 * Require specific role(s)
 */
function requireRole(...roles) {
    return (req, res, next) => {
        const userRole = req.user?.role;

        if (!userRole) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                code: 'NO_ROLE'
            });
        }

        if (!roles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: `This action requires one of these roles: ${roles.join(', ')}`,
                code: 'INSUFFICIENT_ROLE',
                required: roles,
                current: userRole
            });
        }

        next();
    };
}

/**
 * Super Admin only middleware
 */
function requireSuperAdmin(req, res, next) {
    const userRole = req.user?.role;

    if (userRole !== 'SUPER_ADMIN') {
        return res.status(403).json({
            success: false,
            error: 'Super Admin access required',
            code: 'SUPER_ADMIN_ONLY'
        });
    }

    next();
}

/**
 * Owner or Admin only
 */
function requireOwnerOrAdmin(req, res, next) {
    const userRole = req.user?.role;

    if (!['OWNER', 'ADMIN'].includes(userRole)) {
        return res.status(403).json({
            success: false,
            error: 'Owner or Admin access required',
            code: 'OWNER_ADMIN_ONLY',
            current: userRole
        });
    }

    next();
}

/**
 * Verify user belongs to tenant (tenant isolation)
 */
async function verifyTenantAccess(req, res, next) {
    try {
        const userId = req.user?.userId || req.user?.id;
        const userTenantId = req.user?.tenantId;
        const requestedTenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;

        // Super admin can access any tenant
        if (req.user?.role === 'SUPER_ADMIN') {
            return next();
        }

        // No tenant requested - use user's tenant
        if (!requestedTenantId) {
            req.scopedTenantId = userTenantId;
            return next();
        }

        // Verify user belongs to requested tenant
        if (requestedTenantId !== userTenantId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied to this organization',
                code: 'TENANT_ACCESS_DENIED'
            });
        }

        req.scopedTenantId = userTenantId;
        next();
    } catch (error) {
        console.error('Tenant verification error:', error);
        return res.status(500).json({
            success: false,
            error: 'Tenant verification failed'
        });
    }
}

/**
 * Get user's effective permissions
 */
async function getUserPermissions(req, res) {
    try {
        const userRole = req.user?.role;
        const userId = req.user?.userId || req.user?.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                tenant: true,
                subscription: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const permissions = PERMISSIONS[userRole] || {};

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                tenantId: user.tenantId
            },
            tenant: {
                id: user.tenant.id,
                name: user.tenant.name,
                plan: user.tenant.plan
            },
            permissions,
            isSuperAdmin: userRole === 'SUPER_ADMIN',
            isOwner: userRole === 'OWNER',
            isAdmin: ['OWNER', 'ADMIN'].includes(userRole)
        });
    } catch (error) {
        console.error('Error fetching user permissions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch permissions'
        });
    }
}

module.exports = {
    checkPermission,
    requireRole,
    requireSuperAdmin,
    requireOwnerOrAdmin,
    verifyTenantAccess,
    getUserPermissions,
    PERMISSIONS
};
