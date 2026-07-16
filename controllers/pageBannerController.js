import PageBanner from '../models/PageBanner.js';

/**
 * Fetch banner data by pageKey.
 * Return a 404 if not found.
 */
export const getAllPageBanners = async (req, res) => {
  try {
    const banners = await PageBanner.find({ isActive: true });
    res.json({
      success: true,
      message: '✅ All page banners retrieved successfully',
      data: banners,
      err: {}
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
      data: [],
      err: { message: err.message }
    });
  }
};

/**
 * Fetch banner data by pageKey.
 */
export const getBannerByPage = async (req, res) => {
  try {
    const { pageKey } = req.params;
    const banner = await PageBanner.findOne({ pageKey, isActive: true });

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: `Banner not found for pageKey: ${pageKey}`,
        data: {},
        err: { message: 'Banner not found' }
      });
    }

    res.json({
      success: true,
      message: '✅ Page banner retrieved successfully',
      data: banner,
      err: {}
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: { message: err.message }
    });
  }
};

/**
 * Create or update banner data for a specific page.
 */
export const upsertBanner = async (req, res) => {
  console.log("--- UPSERT ATTEMPT ---");
  console.log("REQ.BODY:", JSON.stringify(req.body, null, 2));
  console.log("REQ.FILE:", req.file);

  try {
    let updateData = req.body;

    // If data is sent as a stringified JSON (common for multipart/form-data with nested objects)
    if (updateData.data) {
      try {
        const parsedData = typeof updateData.data === 'string' 
          ? JSON.parse(updateData.data) 
          : updateData.data;
        updateData = { ...parsedData, ...updateData };
        delete updateData.data;
      } catch (e) {
        console.error("Failed to parse data field:", e);
      }
    }

    const { pageKey } = updateData;
    if (!pageKey) {
      return res.status(400).json({
        success: false,
        message: 'pageKey is required for upserting a banner',
        data: {},
        err: { message: 'Missing pageKey' }
      });
    }

    // Handle uploaded file
    let imageObj = (updateData.image && typeof updateData.image === 'object') ? { ...updateData.image } : {};
    
    if (req.file) {
      imageObj.src = req.file.filename;
    }

    // Ensure imageObj is set back into updateData
    updateData.image = imageObj;

    // If no src even after file check, prevent Mongoose error with custom message
    if (!updateData.image.src) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed: Image is required. Please upload a hero banner.',
        data: {},
        err: { message: 'image.src is required' }
      });
    }

    console.log("FINAL UPDATE DATA:", JSON.stringify(updateData, null, 2));

    const banner = await PageBanner.findOneAndUpdate(
      { pageKey },
      { ...updateData, updatedAt: Date.now() },
      { new: true, upsert: true, runValidators: true }
    );

    // Fetch all banners to return a complete state as requested
    const allBanners = await PageBanner.find({ isActive: true });

    res.status(200).json({
      success: true,
      message: '✅ Page banner upserted successfully',
      data: allBanners,
      err: {}
    });
  } catch (err) {
    console.error("UPSERT ERROR:", err);
    res.status(400).json({
      success: false,
      message: err.message || 'Validation failed or database error',
      data: {},
      err: { 
        message: err.message,
        details: err.errors // This might contain Mongoose validation details
      }
    });
  }
};

/**
 * Bulk create or update banner data for multiple pages.
 * Handles multiple files by checking field names like 'file_[pageKey]'.
 */
export const bulkUpsertBanners = async (req, res) => {
  console.log("--- BULK UPSERT ATTEMPT ---");
  try {
    let { banners } = req.body;
    
    if (typeof banners === 'string') {
      try {
        banners = JSON.parse(banners);
      } catch (e) {
        return res.status(400).json({ success: false, message: "Invalid banners JSON format" });
      }
    }

    if (!Array.isArray(banners)) {
      return res.status(400).json({ success: false, message: "Banners must be an array" });
    }

    console.log(`Processing ${banners.length} banners...`);

    const upsertPromises = banners.map(async (incomingData) => {
      const { pageKey } = incomingData;
      if (!pageKey) return null;

      // 1. STRIP PROTECTED METADATA
      // We must remove these to allow Mongoose to update/upsert without "immutable field" errors
      const { _id, __v, createdAt, updatedAt, ...cleanData } = incomingData;

      // 2. HANDLE IMAGES
      // Get the specific file for this pageKey if provided
      const file = (req.files || []).find(f => f.fieldname === `file_${pageKey}`);
      
      let imageObj = (cleanData.image && typeof cleanData.image === 'object') 
        ? { ...cleanData.image } 
        : {};
      
      if (file) {
        console.log(`[BULK] New file for ${pageKey}: ${file.filename}`);
        imageObj.src = file.filename;
      }
      
      cleanData.image = imageObj;

      // 3. VALIDATE IMAGE SRC
      if (!cleanData.image.src) {
        console.warn(`[BULK] Skipping ${pageKey} - No image source (src is empty)`);
        return null;
      }

      console.log(`[BULK] Upserting ${pageKey}...`);
      return PageBanner.findOneAndUpdate(
        { pageKey },
        { ...cleanData, updatedAt: Date.now(), isActive: true },
        { new: true, upsert: true, runValidators: true }
      );
    });

    const results = await Promise.all(upsertPromises);
    const savedCount = results.filter(r => r !== null).length;
    console.log(`[BULK] Successfully upserted ${savedCount} banners.`);

    // Return all banners after bulk update
    const allBanners = await PageBanner.find({ isActive: true });

    res.status(200).json({
      success: true,
      message: `✅ ${savedCount} page banners updated successfully`,
      data: allBanners,
      err: {}
    });
  } catch (err) {
    console.error("BULK UPSERT FATAL ERROR:", err);
    res.status(400).json({
      success: false,
      message: err.message || 'Bulk update failed',
      data: [],
      err: { message: err.message }
    });
  }
};
