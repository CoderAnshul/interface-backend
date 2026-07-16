import videoLessonService from '../service/videoLessonService.js';
import fs from "fs";
import path from "path";

class VideoLessonController {
  // Create a new video lesson with file upload
 async createVideoLesson(req, res) {
    try {
      let videoFilePath = null;

      if (req.file) {
        // Multer upload
        videoFilePath = req.file.path;
      } else if (req.body.filePath) {
        // Chunked upload
        videoFilePath = path.resolve(req.body.filePath);
        if (!fs.existsSync(videoFilePath)) {
          return res.status(400).json({
            success: false,
            error: "Provided filePath does not exist",
          });
        }
      }

      const result = await videoLessonService.createVideoLesson(
        req.body,
        videoFilePath
      );

      if (result.success) {
        return res.status(201).json({
          success: true,
          data: result.data,
          message: result.message,
          uploadDetails: result.uploadDetails,
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error,
          videoLessonId: result.videoLessonId,
        });
      }
    } catch (error) {
      console.error("❌ CreateVideoLesson error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  // Update video lesson (support filePath too)
  async updateVideoLesson(req, res) {
    try {
      const { id } = req.params;
      let videoFilePath = null;

      if (req.file) {
        videoFilePath = req.file.path;
      } else if (req.body.filePath) {
        videoFilePath = path.resolve(req.body.filePath);
        if (!fs.existsSync(videoFilePath)) {
          return res.status(400).json({
            success: false,
            error: "Provided filePath does not exist",
          });
        }
      }

      //console.log("📥 Update Video Lesson Request:", req.body);
      //console.log("📥 Video File Path:", videoFilePath);

      const result = await videoLessonService.updateVideoLesson(
        id,
        req.body,
        videoFilePath
      );

      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result.data,
          message: result.message,
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      console.error("❌ UpdateVideoLesson error:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }


  // Get video lesson by ID
  async getVideoLesson(req, res) {
    try {
      const { id } = req.params;
      const result = await videoLessonService.getVideoLessonById(id);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result.data
        });
      } else {
        return res.status(404).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Get all video lessons with pagination and filtering
  async getAllVideoLessons(req, res) {
    try {
      const { page, limit, sort, status, sourcePlatform, lessonId } = req.query;
      
      const filters = {};
      if (status) filters.status = status;
      if (sourcePlatform) filters.sourcePlatform = sourcePlatform;
      if (lessonId) filters.lessonId = lessonId;
      
      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        sort: sort ? JSON.parse(sort) : { createdAt: -1 }
      };
      
      const result = await videoLessonService.getAllVideoLessons(filters, options);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result.data,
          pagination: result.pagination
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Get video lessons by lesson ID
  async getVideoLessonsByLesson(req, res) {
    try {
      const { lessonId } = req.params;
      const result = await videoLessonService.getVideoLessonsByLessonId(lessonId);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result.data
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Get video lessons by platform
  async getVideoLessonsByPlatform(req, res) {
    try {
      const { platform } = req.params;
      const result = await videoLessonService.getVideoLessonsByPlatform(platform);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result.data
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Update video lesson
  async updateVideoLesson(req, res) {
  try {
    const { id } = req.params;
    const videoFile = req.file;

    //console.log('📥 Update Video Lesson Request:', req.body);
    //console.log('📥 Uploaded Video File:', videoFile);
    

    const result = await videoLessonService.updateVideoLesson(id, req.body, videoFile);

    if (result.success) {
      return res.status(200).json({
        success: true,
        data: result.data,
        message: result.message
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}


  // Delete video lesson (soft delete)
  async deleteVideoLesson(req, res) {
    try {
      const { id } = req.params;
      const result = await videoLessonService.deleteVideoLesson(id);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          message: result.message
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Update video status
  async updateVideoStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const result = await videoLessonService.updateVideoStatus(id, status);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result.data,
          message: result.message
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Get video lessons by status
  async getVideoLessonsByStatus(req, res) {
    try {
      const { status } = req.params;
      const result = await videoLessonService.getVideoLessonsByStatus(status);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          data: result.data
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

export default new VideoLessonController();