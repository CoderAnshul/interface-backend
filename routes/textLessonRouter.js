import express from 'express';
import {

createTextLesson,
getAllTextLessons,
getTextLessonById,
updateTextLesson,
deleteTextLesson
} from '../controllers/textLessonController.js';
import { upload } from '../middlewares/upload-middleware.js';

const Textrouter = express.Router();

// Create a new text lesson
Textrouter.post('/', upload.any(), createTextLesson);

// Get all text lessons
Textrouter.get('/', getAllTextLessons);

// Get a single text lesson by ID
Textrouter.get('/:id', getTextLessonById);

// Update a text lesson
Textrouter.put('/:id',upload.any(), updateTextLesson);

// Delete a text lesson
Textrouter.delete('/:id', deleteTextLesson);

export default Textrouter;