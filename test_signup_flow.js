import mongoose from 'mongoose';
import User from './models/user.js';
import UserService from './service/userService.js';
import dotenv from 'dotenv';
dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/dipani_edu';

async function testSignup() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Find a partner first to use their code
        const partner = await User.findOne({ role: 'partner', 'company.referralCode': { $exists: true, $ne: '' } });
        if (!partner) {
            console.error('No partner found in DB to test referral');
            process.exit(1);
        }

        const referralCode = partner.company.referralCode;
        console.log('Using referral code:', referralCode, 'for partner:', partner.fullName);

        const userService = new UserService();
        const testEmail = `test_referral_${Date.now()}@example.com`;

        console.log('Signing up new student with referral code...');
        const newUser = await userService.signup({
            fullName: 'Test Referral Student',
            email: testEmail,
            password: 'password123',
            role: 'student',
            is_verify: true,
            referralCode: referralCode.toLowerCase() // Test case-insensitivity
        });

        console.log('New user created. ID:', newUser._id);
        console.log('referredBy field:', newUser.referredBy);

        if (newUser.referredBy && newUser.referredBy.toString() === partner._id.toString()) {
            console.log('✅ Referral LINK SUCCESSFUL!');
        } else {
            console.log('❌ Referral link FAILED.');
        }

        // Cleanup
        await User.deleteOne({ _id: newUser._id });
        console.log('Test user deleted');

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

testSignup();
