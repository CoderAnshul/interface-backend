import express from 'express';
import { getSettings, getAllSettings, updateSetting } from '../controllers/settingController.js';

const router = express.Router();

// POST /settings - Get settings by keys
router.post('/', getSettings);

router.get('/', getAllSettings);

router.post('/update', updateSetting);

export default router;