import express from 'express';
import passport from 'passport';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { requestManualSubscription, initiateSubscriptionPayment, getMySubscriptionPlan } from '../controllers/subscriptionPurchaseController.js';

const router = express.Router();

// Partner: Request manual subscription (admin approval)
router.post('/manual', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), requestManualSubscription);

// Partner: Initiate Cashfree subscription payment
router.post('/cashfree', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), initiateSubscriptionPayment);

// Logged-in user: Get my subscription plan
router.get('/my-plan', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), getMySubscriptionPlan);

export default router;
