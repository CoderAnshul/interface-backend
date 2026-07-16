import express from 'express';
import { startOrContinueChat, getChatHistory, getMessages } from '../controllers/aiChatController.js';
import { getAISettings, updateAISettings } from '../controllers/aiSettingsController.js';
import { addKnowledgeBaseItem, listKnowledgeBaseItems, deleteKnowledgeBaseItem, getKnowledgeBaseItem } from '../controllers/knowledgeBaseController.js';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
import passport from 'passport';

const router = express.Router();

router.use(passport.authenticate('jwt', { session: false }));
router.post('/chat', startOrContinueChat);
router.get('/history', getChatHistory);
router.get('/messages/:roomId', getMessages);

// AI Settings
router.get('/settings', getAISettings);
router.put('/settings', updateAISettings);

// Knowledge Base
router.get('/knowledge', listKnowledgeBaseItems);
router.post('/knowledge', upload.array('files'), addKnowledgeBaseItem);
router.get('/knowledge/:id', getKnowledgeBaseItem);
router.delete('/knowledge/:id', deleteKnowledgeBaseItem);

export default router;
