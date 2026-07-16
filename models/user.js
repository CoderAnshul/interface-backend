// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  fullName: { type: String, trim: true, required: true },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
    // match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'instructor', 'student', 'news_editor', 'partner'], // Updated enum
    default: 'student',
    index: true
  },

  is_verify: { type: Boolean, default: false }, // New field for email verification

  // Common fields
  profilePicture: { type: String, default: 'default-profile.png' },
  bio: { type: String, trim: true },
  phone: { type: String, trim: true },

  // Student-specific
  enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  progress: [{
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    completedLessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }]
  }],

  // Instructor-specific
  teachingCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  qualifications: [{ type: String, trim: true }],

  // Admin-specific
  isActive: { type: Boolean, default: true },

  documentation: [
    {
      name: { type: String, trim: true },
      Doc: { type: String }
    }
  ],



  // Optional address fields
  address: {
    street: { type: String, trim: true },
    block: { type: String, trim: true },
    city: { type: String, trim: true },
    district: { type: String, trim: true },
    state: { type: String, trim: true },
    pinCode: { type: String, trim: true },
    zipCode: { type: String, trim: true }
  },

  // Optional education fields
  education: [{
    institution: { type: String, trim: true },
    degree: { type: String, trim: true },
    fieldOfStudy: { type: String, trim: true },
    startDate: { type: Date },
    endDate: { type: Date }
  }],

  status: { type: String, enum: ['active', 'inactive', 'pending_approval'], default: 'active' },

  // Optional skills
  skills: [{ type: String, trim: true }],

  // Password reset fields
  passwordChangedAt: { type: Date },
  passwordResetToken: { type: String, default: null },
  passwordResetExpiry: { type: Date, default: null },

  otp: { type: String, default: null },
  otpExpiry: { type: Date, default: null },
  emailVerified: { type: Boolean, default: false },
  mobileVerified: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String },
  isShadowBanned: { type: Boolean, default: false },


  // gstNumber and CompanyName grouped under company
  company: {
    name: { type: String, trim: true },
    referralCode: { type: String, trim: true, unique: true, sparse: true }, // Added referralCode
  },

  // Partner-specific fields
  partnerInfo: {
    businessType: {
      type: String,
      enum: ['Agent', 'Franchise', 'Referral Partner'],
      default: 'Referral Partner'
    },
    city: { type: String, trim: true },
    bankDetails: {
      accountHolderName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      bankName: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      branch: { type: String, trim: true }
    }
  },

  // Partner referral tracking: stores the partner's _id who referred this student
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },


  // Registration payment details (primarily for partners)
  registrationPayment: {
    method: { type: String, enum: ['online', 'manual'], default: 'online' },
    transactionId: { type: String, trim: true },
    amount: { type: Number },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoursePlan' },
    paidAt: { type: Date }
  },

  // Subscription details for partners (resellers)
  subscription: {
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    transactionId: { type: String, trim: true },
    amount: { type: Number },
    method: { type: String, enum: ['online', 'manual'], default: 'online' },
    status: { type: String, enum: ['pending', 'active', 'expired', 'failed'], default: 'pending' },
    startedAt: { type: Date },
    expiresAt: { type: Date },
    paidAt: { type: Date }
  },


}, { timestamps: true });

// Indexes
userSchema.index({ email: 1, status: 'active' });
userSchema.index({ role: 1 });
userSchema.index({ passwordResetToken: 1 });
userSchema.index({ passwordResetExpiry: 1 });
// Index to quickly find users referred by a partner
userSchema.index({ referredBy: 1 });

export default mongoose.models.User || mongoose.model('User', userSchema);
