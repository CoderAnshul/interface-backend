import express from 'express';
import {
    createLead,
    getMyLeads,
    updateLead,
    deleteLead
} from '../controllers/leadController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import isUserBanned from '../middlewares/isUserBanned.js';

const router = express.Router();

// All lead routes require authentication and partner role (checked via logic or specific middleware)
router.use(accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), isUserBanned);

router.post('/', createLead);
router.get('/', getMyLeads);
router.put('/:id', updateLead);
router.delete('/:id', deleteLead);

export default router;
