import User from '../models/user.js';
import sendEmail from '../utils/sendEmail.js';
// import sendSMS from '../utils/sendSMS.js'; // optional

// Hardcoded OTP for testing
// const generateOtp = () => '123456';
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString(); 


// SEND OTP
export const sendOtp = async (req, res) => {
  try {
    const { email, phone, type } = req.body;

    if (!type || (type !== 'email' && type !== 'mobile')) {
      return res.status(400).json({ success: false, message: "Type must be 'email' or 'mobile'" });
    }

    const identifier = type === 'email' ? email : phone;
    if (!identifier) {
      return res.status(400).json({ success: false, message: `${type} is required` });
    }

    const user = await User.findOne(type === 'email' ? { email } : { phone });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Use default OTP for specific phone number
    let otp;
    if (phone == '7990739534' || phone == 7990739534) {
      otp = '123456';
    } else {
      otp = generateOtp();
    }
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    if (type === 'email') {
      await sendEmail(email, `Your OTP is ${otp}`, 'OTP Verification');
    } else {
      // await sendSMS(phone, `Your OTP is ${otp}`);
    }

    return res.status(200).json({ success: true, message: `OTP sent to your ${type}` });
  } catch (err) {
    console.error('❌ sendOtp Error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// VERIFY OTP
export const verifyOtp = async (req, res) => {
  try {
    const { email, phone, otp } = req.body;

    if (!otp || (!email && !phone)) {
      return res.status(400).json({ success: false, message: "OTP and email or phone are required" });
    }

    const user = await User.findOne(email ? { email } : { phone });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    //console.log('🔍 OTP Check:', {
    //   enteredOtp: otp,
    //   savedOtp: user.otp,
    //   otpExpiry: user.otpExpiry,
    //   currentTime: Date.now()
    // });

    if (user.otp !== otp || user.otpExpiry < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Mark verified
    if (email) user.emailVerified = true;
    if (phone) user.mobileVerified = true;

    // Clear OTP fields
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    return res.status(200).json({ success: true, message: 'OTP verified successfully' });
  } catch (err) {
    console.error('❌ verifyOtp Error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};
