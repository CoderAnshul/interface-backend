import express from 'express';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import {
    createDripRule,
    getAllDripRules,
    deleteDripRule,
    getDripForTarget,
    getDripTargetsByReferenceId,
    updateDripRuleByReferenceId,
} from '../controllers/dripController.js';

const router = express.Router();

// Supports bulk drip rule creation: pass array of targetId for multiple lessons/modules
router.post('/drip-rule',accessTokenAutoRefresh, createDripRule);
router.get('/drip-rules', getAllDripRules);
// router.delete('/drip-rule/:id', accessTokenAutoRefresh, isAdmin, deleteDripRule);
///api/drip/module/665c914ec2d86c3f48567fbc
//drip-targets/by-reference/:referenceId
router.get('/drip-rules/by-reference/:referenceId', accessTokenAutoRefresh, getDripTargetsByReferenceId);
// Update DripRule by referenceId
router.put('/drip-rules/by-target/:targetID', updateDripRuleByReferenceId);
router.delete('/drip-rule/:id', accessTokenAutoRefresh, deleteDripRule);


// Get drip rules for a specific target type and ID



router.get('/drip-rules/:targetType/:targetId', accessTokenAutoRefresh, getDripForTarget);

export default router;