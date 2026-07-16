import express from 'express';
import videoLessonController from '../controllers/videoLessonController.js';
import path from 'path';
import fs from 'fs';
import vedioCypherService from '../service/platforms/videoCypherService.js';

import {upload} from '../middlewares/upload-middleware.js';


const VedioRouter = express.Router();


// Create video lesson with file upload
VedioRouter.post('/', upload.single('video'), videoLessonController.createVideoLesson);

// Add to your routes
VedioRouter.get('/test-videocypher', async (req, res) => {
  try {
    
    const isValid = await vedioCypherService.validateApiKey();
    res.json({ 
      valid: isValid,
      apiKeySet: !!process.env.VIDEOCYPHER_API_KEY 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all video lessons
VedioRouter.get('/', videoLessonController.getAllVideoLessons);

// Video streaming endpoint for manual uploads
VedioRouter.get('/stream/:filename', (req, res) => {
  const manualUploadService = require('../services/platforms/manualUploadService.js').default;
  manualUploadService.streamVideo(req.params.filename, req, res);
});

// Thumbnail endpoint for manual uploads
VedioRouter.get('/thumbnail/:filename', (req, res) => {
  const thumbnailPath = path.join(process.env.MANUAL_UPLOAD_PATH || 'uploads/videos', 'thumbnails', req.params.filename);
  if (fs.existsSync(thumbnailPath)) {
    res.sendFile(path.resolve(thumbnailPath));
  } else {
    res.status(404).json({ error: 'Thumbnail not found' });
  }
});

// Get video lesson by ID
VedioRouter.get('/:id', videoLessonController.getVideoLesson);

// Get video lessons by lesson ID
VedioRouter.get('/lesson/:lessonId', videoLessonController.getVideoLessonsByLesson);

// Get video lessons by platform
VedioRouter.get('/platform/:platform', videoLessonController.getVideoLessonsByPlatform);

// Get video lessons by status
VedioRouter.get('/status/:status', videoLessonController.getVideoLessonsByStatus);

// Update video lesson
VedioRouter.put('/:id', upload.single('video'),videoLessonController.updateVideoLesson);

// Update video status
VedioRouter.patch('/:id/status', videoLessonController.updateVideoStatus);

// Delete video lesson
VedioRouter.delete('/:id', videoLessonController.deleteVideoLesson);

export default VedioRouter;
