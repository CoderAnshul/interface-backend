import express from 'express';
import {
    getAllPartnerReferrals,
    getPartnerReferralStats,
    getMyReferrals,
    getMyReferralStats,
    getMyPayoutHistory,
    getMyCommissions
} from '../controllers/partnerReferralController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';
import isUserBanned from '../middlewares/isUserBanned.js';

const router = express.Router();

// Admin routes - Get all partner referrals
router.get(
    '/referrals',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    isUserBanned,
    getAllPartnerReferrals
);

// Admin routes - Get partner referral statistics
router.get(
    '/referrals/stats',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isAdmin,
    isUserBanned,
    getPartnerReferralStats
);

// Partner routes - Get my referrals
router.get(
    '/my-referrals',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isUserBanned,
    getMyReferrals
);

// Partner routes - Get my referral statistics
router.get(
    '/my-referrals/stats',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isUserBanned,
    getMyReferralStats
);

// Partner routes - Get my payout history
router.get(
    '/payouts',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isUserBanned,
    getMyPayoutHistory
);

// Partner routes - Get my commissions breakdown
router.get(
    '/commissions',
    accessTokenAutoRefresh,
    passport.authenticate('jwt', { session: false }),
    isUserBanned,
    getMyCommissions
);

export default router;

