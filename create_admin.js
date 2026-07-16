import mongoose from 'mongoose';
import User from './models/user.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const mongoUri = process.env.MONGO_URI;

async function createAdmin() {
  try {
    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in the environment variables');
    }
    
    console.log('Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const adminEmail = 'admin_global@everythinggloble.com';
    const adminPassword = 'AdminGlobalPass2026!';
    
    // Check if user already exists
    let user = await User.findOne({ email: adminEmail });
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);
    
    if (user) {
      console.log('Admin user already exists. Updating password and role to ensure admin privileges...');
      user.password = hashedPassword;
      user.role = 'admin';
      user.is_verify = true;
      user.emailVerified = true;
      user.status = 'active';
      user.isActive = true;
      await user.save();
      console.log('Admin user updated.');
    } else {
      console.log('Creating new admin user...');
      user = new User({
        fullName: 'Global Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        is_verify: true,
        emailVerified: true,
        status: 'active',
        isActive: true
      });
      await user.save();
      console.log('Admin user created successfully.');
    }

    console.log('====================================');
    console.log('  NEW ADMIN CREDENTIALS CREATED');
    console.log('====================================');
    console.log('Admin ID / Email:', adminEmail);
    console.log('Admin Password  :', adminPassword);
    console.log('====================================');
    
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
}

createAdmin();
