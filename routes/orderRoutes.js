import express from 'express';
import { getOrders, approveManualOrder, syncMissingPartnerOrders } from '../controllers/orderController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

const router = express.Router();

router.use(accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isAdmin);

router.get('/', getOrders);
router.post('/sync-partner-orders', syncMissingPartnerOrders);
router.post('/:orderId/approve', approveManualOrder);

export default router;
