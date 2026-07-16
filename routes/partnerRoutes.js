import express from 'express';
import passport from 'passport';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import { getAllPartners, getPartnerById, updatePartner, getPartnerStudents } from '../controllers/partnerController.js';
import { getPartnerEarnings } from '../controllers/earningsController.js';
import { requestPayout, getPartnerPayouts, getAdminPayouts, updatePayoutStatus } from '../controllers/payoutController.js';
import { 
    getAllPartnerReferrals, 
    getPartnerReferralStats, 
    getMyReferrals, 
    getMyReferralStats, 
    getMyPayoutHistory, 
    getMyCommissions 
} from '../controllers/partnerReferralController.js';
import isUserBanned from '../middlewares/isUserBanned.js';

const partnerRouter = express.Router();

// Middleware: allow only partners (or admin)
const isPartnerOrAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'partner' || req.user.role === 'admin')) {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: 'Access denied: Partner or Admin role required',
        data: {},
        err: {}
    });
};

const isPartnerOnly = (req, res, next) => {
    if (req.user && req.user.role === 'partner') {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: 'Access denied: Partner role required',
        data: {},
        err: {}
    });
};

partnerRouter.get(
    '/',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    getAllPartners
);

partnerRouter.get(
    '/my-students',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isPartnerOnly,
    getPartnerStudents
);

// ✅ Earnings summary for the logged-in partner
partnerRouter.get(
    '/earnings',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isPartnerOrAdmin,
    getPartnerEarnings
);

// ── Referral & Analytics Routes ──────────────────────────────────────────

// Admin: Get all partner referrals
partnerRouter.get(
    '/referrals',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    isUserBanned,
    getAllPartnerReferrals
);

// Admin: Get partner referral statistics
partnerRouter.get(
    '/referrals/stats',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    isUserBanned,
    getPartnerReferralStats
);

// Partner: Get my referrals
partnerRouter.get(
    '/my-referrals',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isUserBanned,
    getMyReferrals
);

// Partner: Get my referral statistics
partnerRouter.get(
    '/my-referrals/stats',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isUserBanned,
    getMyReferralStats
);

// Partner: Get my payout history (Referral system)
partnerRouter.get(
    '/payouts',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isUserBanned,
    getMyPayoutHistory
);

// Partner: Get my commissions breakdown
partnerRouter.get(
    '/commissions',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isUserBanned,
    getMyCommissions
);

// ── Payout Routes ────────────────────────────────────────────────────────

// Partner: Request withdrawal
partnerRouter.post(
    '/payouts/request',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isPartnerOrAdmin,
    requestPayout
);

// Partner: Get own payout history
partnerRouter.get(
    '/payouts/my-history',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isPartnerOrAdmin,
    getPartnerPayouts
);

// Admin: Get all payout requests
partnerRouter.get(
    '/payouts/admin/list',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    getAdminPayouts
);

// Admin: Update payout status (approve/reject)
partnerRouter.put(
    '/payouts/admin/:id/status',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    updatePayoutStatus
);

// ── Generic Partner Routes (Last) ──────────────────────────────────────────

partnerRouter.get(
    '/:id',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    getPartnerById
);

partnerRouter.put(
    '/:id',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    updatePartner
);

export default partnerRouter;
