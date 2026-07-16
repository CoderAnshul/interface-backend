const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI;

const PageBannerSchema = new mongoose.Schema({
  pageKey: String,
  isActive: Boolean,
  image: { src: String }
}, { strict: false });

// Specify the collection name 'pagebanners' directly
const PageBanner = mongoose.model('PageBannerDiag', PageBannerSchema, 'pagebanners');

async function check() {
  try {
    console.log("Connecting to:", MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");
    const banners = await PageBanner.find({});
    console.log("Found Banners Data:");
    console.log(JSON.stringify(banners.map(b => ({ 
        pageKey: b.pageKey, 
        isActive: b.isActive, 
        imageSrc: b.image ? b.image.src : 'MISSING' 
    })), null, 2));
    process.exit(0);
  } catch (err) {
    console.error("ERROR:", err);
    process.exit(1);
  }
}

check();
