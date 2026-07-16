import mongoose from "mongoose";

const groupMessageSchema = new mongoose.Schema({
  groupChatRoomId: { type: mongoose.Schema.Types.ObjectId, ref: "GroupChatRoom", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, required: true },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("GroupMessage", groupMessageSchema);