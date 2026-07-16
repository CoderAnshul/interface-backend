import { updateLessonProgressDirect } from '../controllers/ProgressController.js';

// Store last update time per user to throttle updates
const progressCache = new Map();

const videoSocketHandler = (socket) => {
  socket.on('video-progress', async (data) => {
    //console.log('Received video progress data:', data);
    
    const { videoId, userId, currentTime, duration, courseId, lessonId } = data;
    
    // Throttle updates per user - only allow updates every 30 seconds
    const cacheKey = `${userId}-${lessonId || videoId}`;
    const lastUpdate = progressCache.get(cacheKey) || 0;
    const now = Date.now();
    
    if (now - lastUpdate < 1000) { // 30 seconds throttle
      //console.log(`Progress update throttled for user ${userId}`);
      return;
    }
    
    progressCache.set(cacheKey, now);
    
    //console.log(`Received video progress from ${socket.id}:`, data);
    
    if (!videoId || !userId || currentTime === undefined) {
      return socket.emit('error', { message: 'Invalid progress data' });
    }

    try {
      // Calculate progress percentage
      const progressPercentage = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
      
      // Use the lessonId if provided, otherwise fall back to videoId
      const targetLessonId = lessonId || videoId;
      
      // Call the direct service function with proper data structure
      const updateData = {
        watchTime: currentTime,
        currentPosition: currentTime,
        lastPosition: currentTime,
        progressPercentage: progressPercentage,
        sessionId: socket.id,
        videoDuration: duration,
        ...(progressPercentage > 80 && { completed: true })
      };

      const update = await updateLessonProgressDirect(
        userId, 
        targetLessonId, 
        courseId, 
        updateData
      );

      //console.log(`Updated progress for video ${videoId}, user ${userId}`);

      socket.emit('progress-updated', {
        success: true,
        data: update,
      });
    } catch (err) {
      console.error('Socket DB update error:', err?.message);
      socket.emit('error', { message: 'Failed to update progress' });
    }
  });

  // // Handle video completion
  // socket.on('video-complete', async (data) => {
  //   //console.log('Received video completion data:', data);
    
  //   const { videoId, userId, duration, courseId, lessonId } = data;
    
  //   if (!videoId || !userId) {
  //     return socket.emit('error', { message: 'Invalid completion data' });
  //   }

  //   try {
  //     const targetLessonId = lessonId || videoId;
      
  //     const completionData = {
  //       watchTime: duration || 0,
  //       currentPosition: duration || 0,
  //       lastPosition: duration || 0,
  //       progressPercentage: 100,
  //       completed: true,
  //       completionPercentage: 100,
  //       sessionId: socket.id,
  //       videoDuration: duration
  //     };

  //     const update = await updateLessonProgressDirect(
  //       userId, 
  //       targetLessonId, 
  //       courseId, 
  //       completionData
  //     );

  //     //console.log(`Completed video ${videoId} for user ${userId}`);

  //     // Clear throttle cache for this user/lesson when video is completed
  //     const cacheKey = `${userId}-${targetLessonId}`;
  //     progressCache.delete(cacheKey);

  //     socket.emit('video-completed', {
  //       success: true,
  //       data: update,
  //     });
  //   } catch (err) {
  //     console.error('Socket completion error:', err?.message);
  //     socket.emit('error', { message: 'Failed to mark video as complete' });
  //   }
  // });

  // // Handle video pause/resume for more granular tracking
  // socket.on('video-pause', async (data) => {
  //   const { videoId, userId, currentTime, courseId, lessonId } = data;
    
  //   try {
  //     const targetLessonId = lessonId || videoId;
  //     const updateData = {
  //       lastPosition: currentTime,
  //       sessionId: socket.id
  //     };

  //     await updateLessonProgressDirect(userId, targetLessonId, courseId, updateData);
      
  //     socket.emit('video-paused', { success: true });
  //   } catch (err) {
  //     console.error('Socket pause error:', err?.message);
  //   }
  // });

  // // Handle video resume
  // socket.on('video-resume', async (data) => {
  //   const { videoId, userId, currentTime, courseId, lessonId } = data;
    
  //   try {
  //     const targetLessonId = lessonId || videoId;
  //     const updateData = {
  //       lastPosition: currentTime,
  //       sessionId: socket.id
  //     };

  //     await updateLessonProgressDirect(userId, targetLessonId, courseId, updateData);
      
  //     socket.emit('video-resumed', { success: true });
  //   } catch (err) {
  //     console.error('Socket resume error:', err?.message);
  //   }
  // });

  // // Handle video seek to update position
  // socket.on('video-seek', async (data) => {
  //   const { videoId, userId, currentTime, courseId, lessonId } = data;
    
  //   try {
  //     const targetLessonId = lessonId || videoId;
  //     const updateData = {
  //       lastPosition: currentTime,
  //       sessionId: socket.id
  //     };

  //     await updateLessonProgressDirect(userId, targetLessonId, courseId, updateData);
      
  //     socket.emit('video-seeked', { success: true });
  //   } catch (err) {
  //     console.error('Socket seek error:', err?.message);
  //   }
  // });

  // Clean up cache when socket disconnects
  socket.on('disconnect', () => {
    //console.log(`Socket disconnected: ${socket.id}`);
    
    // Clean up any cache entries for this socket
    // Note: This is a basic cleanup. For production, you might want more sophisticated cache management
    const socketsToDelete = [];
    progressCache.forEach((timestamp, key) => {
      // Clean up old entries (older than 1 hour)
      if (Date.now() - timestamp > 3600000) {
        socketsToDelete.push(key);
      }
    });
    
    socketsToDelete.forEach(key => {
      progressCache.delete(key);
    });
  });

  // Handle connection event
  socket.on('connect', () => {
    //console.log(`Socket connected: ${socket.id}`);
  });

  // Handle error events
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
};

export default videoSocketHandler;