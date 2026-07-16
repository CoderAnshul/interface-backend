import express from 'express';
import {
    checkout,
    getMyEnrollments,
    buyNow,
    getMyPurchases,
    checkOrder,
    importStudents,
    verifyCashfreePayment,
    getHierarchyOptions
} from '../controllers/checkoutController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import isUserBanned from '../middlewares/isUserBanned.js';
import { upload } from '../middlewares/upload-middleware.js';

const router = express.Router();

router.post('/', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), checkout);

router.get('/my-enrollments', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isUserBanned, getMyEnrollments);
router.get('/my-purchases', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isUserBanned, getMyPurchases);

// Buy Now (guest checkout)
router.post('/buy-now', buyNow);

// Check order + create Cashfree payment session
router.post('/check-order', checkOrder);

// ✅ Verify Cashfree payment after redirect
router.post('/verify-cashfree', verifyCashfreePayment);

// Get hierarchy dropdown options
router.get('/hierarchy-options', getHierarchyOptions);

// Import students
router.post('/import-students', upload.single('file'), importStudents);

export default router;