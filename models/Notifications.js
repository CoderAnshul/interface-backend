import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    data: {
      type: Object, // Example: { title, body, order_id, etc. }
      required: true,
    },
    status: {
      type: Number,
      default: 1, // 1 = unread, 0 = read
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    device_id: { type: String, default: null }, // optional
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

export default mongoose.model("Notification", notificationSchema);
