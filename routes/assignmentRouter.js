import express from 'express';
import {
  createAssignment,
  getAllAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment
} from '../controllers/assignmentController.js';

import { upload } from '../middlewares/upload-middleware.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
const assignmentRouter = express.Router();

assignmentRouter.post(
  '/',
  accessTokenAutoRefresh,
  
  upload.fields([
    { name: 'attachmentFile', maxCount: 1 },
    { name: 'documentFile', maxCount: 1 }
  ]),
  createAssignment
);

assignmentRouter.get('/', getAllAssignments);
assignmentRouter.get('/:id', getAssignmentById);
assignmentRouter.put(
  '/:id',
  upload.fields([
    { name: 'attachmentFile', maxCount: 1 },
    { name: 'documentFile', maxCount: 1 }
  ]),
  updateAssignment
);
assignmentRouter.delete('/:id', deleteAssignment);

export default assignmentRouter;