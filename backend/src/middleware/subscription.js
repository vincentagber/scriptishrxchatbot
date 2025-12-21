// backend/src/middleware/subscription.js
/**
 * Subscription \u0026 Trial Enforcement Middleware
 * 
 * This middleware ensures:
 * 1. Trial users get full access for 14 days
 * 2. After trial expiry, subscription plan limits are enforced
 * 3. Backend-enforced security (not client-side)
 */

const prisma = require('../lib/prisma');

/**
 * Check if user's subscription allows access to a feature
 */
async function checkSubscriptionAccess(req, res, next) {
    try {
        const userId = req.user?.userId || req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                code: 'NO_USER'
            });
        }

        // Load user with subscription
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                subscription: true,
                tenant: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Check if subscription exists
        if (!user.subscription) {
            // FALBACK: 14-Day Free Access for New Users (No Subscription Record Needed)
            const accountAgeMs = new Date() - new Date(user.createdAt);
            const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);

            if (accountAgeDays <= 14) {
                req.subscription = {
                    plan: 'Trial',
                    status: 'Active',
                    isTrialActive: true,
                    daysRemaining: Math.ceil(14 - accountAgeDays),
                    hasFullAccess: true,
                    startDate: user.createdAt,
                    endDate: new Date(new Date(user.createdAt).getTime() + 14 * 24 * 60 * 60 * 1000)
                };
                return next();
            }

            return res.status(403).json({
                success: false,
                error: 'No active subscription',
                code: 'NO_SUBSCRIPTION',
                action: 'subscribe'
            });
        }

        const subscription = user.subscription;
        const now = new Date();

        // Check if subscription is active
        if (subscription.status !== 'Active') {
            return res.status(403).json({
                success: false,
                error: 'Subscription is not active',
                code: 'INACTIVE_SUBSCRIPTION',
                status: subscription.status,
                action: 'reactivate'
            });
        }

        // Check trial status
        if (subscription.plan === 'Trial') {
            if (subscription.endDate && now > subscription.endDate) {
                // Trial has expired - update status
                await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: {
                        status: 'Expired',
                        plan: 'Free' // Downgrade to free tier
                    }
                });

                return res.status(403).json({
                    success: false,
                    error: 'Trial period has ended',
                    code: 'TRIAL_EXPIRED',
                    expiredAt: subscription.endDate,
                    action: 'upgrade',
                    daysRemaining: 0
                });
            }

            // Trial is active - grant full access
            const daysRemaining = Math.ceil((subscription.endDate - now) / (1000 * 60 * 60 * 24));

            req.subscription = {
                ...subscription,
                isTrialActive: true,
                daysRemaining,
                hasFullAccess: true, // During trial, full access to all features
                plan: 'Trial'
            };

            return next();
        }

        // For paid subscriptions, check end date if applicable
        if (subscription.endDate && now > subscription.endDate) {
            await prisma.subscription.update({
                where: { id: subscription.id },
                data: { status: 'Expired' }
            });

            return res.status(403).json({
                success: false,
                error: 'Subscription has expired',
                code: 'SUBSCRIPTION_EXPIRED',
                expiredAt: subscription.endDate,
                action: 'renew'
            });
        }

        // Attach subscription info to request for downstream use
        req.subscription = {
            ...subscription,
            isTrialActive: false,
            daysRemaining: subscription.endDate ? Math.ceil((subscription.endDate - now) / (1000 * 60 * 60 * 24)) : null,
            hasFullAccess: ['Advanced', 'Intermediate'].includes(subscription.plan),
            plan: subscription.plan
        };

        next();
    } catch (error) {
        console.error('Subscription check error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to verify subscription',
            code: 'SUBSCRIPTION_CHECK_FAILED'
        });
    }
}

/**
 * Check if feature is available on current plan
 * Usage: checkFeature('voice_agent'), checkFeature('advanced_analytics')
 */
function checkFeature(featureName) {
    return (req, res, next) => {
        const subscription = req.subscription;

        if (!subscription) {
            return res.status(403).json({
                success: false,
                error: 'Subscription verification required',
                code: 'NO_SUBSCRIPTION_CHECK'
            });
        }

        // During trial, all features are available
        if (subscription.isTrialActive || subscription.hasFullAccess) {
            return next();
        }

        // Feature matrix
        const featureMatrix = {
            'ai_chat': ['Trial', 'Basic', 'Intermediate', 'Advanced'],
            'voice_agent': ['Trial', 'Intermediate', 'Advanced'],
            'advanced_analytics': ['Trial', 'Advanced'],
            'custom_branding': ['Trial', 'Intermediate', 'Advanced'],
            'api_integrations': ['Trial', 'Advanced'],
            'white_label': ['Trial', 'Advanced'],
            'unlimited_clients': ['Trial', 'Intermediate', 'Advanced'],
            'workflow_automation': ['Trial', 'Advanced']
        };

        const allowedPlans = featureMatrix[featureName] || [];

        if (!allowedPlans.includes(subscription.plan)) {
            return res.status(403).json({
                success: false,
                error: `This feature requires ${allowedPlans[allowedPlans.length - 1]} plan or higher`,
                code: 'FEATURE_NOT_AVAILABLE',
                feature: featureName,
                currentPlan: subscription.plan,
                requiredPlan: allowedPlans[allowedPlans.length - 1],
                action: 'upgrade'
            });
        }

        next();
    };
}

/**
 * Get subscription status (for client-side display)
 */
async function getSubscriptionStatus(req, res) {
    try {
        const userId = req.user?.userId || req.user?.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { subscription: true }
        });

        if (!user) {
            return res.json({ success: false, hasSubscription: false });
        }

        // Check for Implicit 14-Day Trial if no subscription exists
        if (!user.subscription) {
            const accountAgeMs = new Date() - new Date(user.createdAt);
            const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);

            if (accountAgeDays <= 14) {
                const endDate = new Date(new Date(user.createdAt).getTime() + 14 * 24 * 60 * 60 * 1000);
                return res.json({
                    success: true,
                    hasSubscription: true,
                    subscription: {
                        plan: 'Trial',
                        status: 'Active',
                        startDate: user.createdAt,
                        endDate: endDate,
                        isTrialActive: true,
                        daysRemaining: Math.ceil(14 - accountAgeDays),
                        features: getFeaturesForPlan('Trial', true)
                    }
                });
            }

            return res.json({
                success: false,
                hasSubscription: false
            });
        }

        const subscription = user.subscription;
        const now = new Date();
        const daysRemaining = subscription.endDate
            ? Math.ceil((subscription.endDate - now) / (1000 * 60 * 60 * 24))
            : null;

        const isTrialActive = subscription.plan === 'Trial'
            && subscription.status === 'Active'
            && (!subscription.endDate || now <= subscription.endDate);

        res.json({
            success: true,
            hasSubscription: true,
            subscription: {
                plan: subscription.plan,
                status: subscription.status,
                startDate: subscription.startDate,
                endDate: subscription.endDate,
                isTrialActive,
                daysRemaining,
                features: getFeaturesForPlan(subscription.plan, isTrialActive)
            }
        });
    } catch (error) {
        console.error('Error fetching subscription status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch subscription status'
        });
    }
}

/**
 * Helper: Get available features for a plan
 */
function getFeaturesForPlan(plan, isTrialActive) {
    const features = {
        'Trial': ['ai_chat', 'voice_agent', 'advanced_analytics', 'custom_branding', 'api_integrations', 'unlimited_clients', 'workflow_automation'],
        'Basic': ['ai_chat'],
        'Intermediate': ['ai_chat', 'voice_agent', 'custom_branding', 'unlimited_clients'],
        'Advanced': ['ai_chat', 'voice_agent', 'advanced_analytics', 'custom_branding', 'api_integrations', 'white_label', 'unlimited_clients', 'workflow_automation']
    };

    return features[plan] || [];
}

/**
 * Background job helper: Mark expired trials/subscriptions
 * Should be run as a cron job
 */
async function expireOldSubscriptions() {
    try {
        const now = new Date();

        const result = await prisma.subscription.updateMany({
            where: {
                status: 'Active',
                endDate: {
                    lte: now
                }
            },
            data: {
                status: 'Expired'
            }
        });

        console.log(`✓ Expired ${result.count} subscriptions`);
        return result.count;
    } catch (error) {
        console.error('Error expiring subscriptions:', error);
        throw error;
    }
}

module.exports = {
    checkSubscriptionAccess,
    checkFeature,
    getSubscriptionStatus,
    expireOldSubscriptions
};
