import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  duration: { type: Number, required: true }, // in days or months
  durationType: { type: String, enum: ["day", "month", "year"], required: true },
  price: { type: Number, required: true },
  status: { type: String, enum: ["active", "inactive"], default: "active" }
}, { timestamps: true });

export default mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
