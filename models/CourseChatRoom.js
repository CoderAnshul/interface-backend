import mongoose from 'mongoose';

const courseChatRoomSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    unique: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

courseChatRoomSchema.index({ courseId: 1 });
courseChatRoomSchema.index({ participants: 1 });

const CourseChatRoom = mongoose.model('CourseChatRoom', courseChatRoomSchema);
export default CourseChatRoom;
