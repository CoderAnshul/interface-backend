import CouponService from '../service/CouponService.js';
import { initRedis } from '../config/redisClient.js';

const couponService = new CouponService();

export const createCoupon = async (req, res) => {
  try {
    //console.log('📩 Request Body createCoupon:', req.body);

    const coupon = await couponService.create(req.body);

    const redis = await initRedis();
    const couponId = coupon._id.toString();
    const couponCacheData = {
      _id: coupon._id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountAmount: coupon.discountAmount,
      discountPercent: coupon.discountPercent,
      maxDiscountValue: coupon.maxDiscountValue,
      minOrderAmount: coupon.minOrderAmount,
      usageLimit: coupon.usageLimit,
      usageLimitPerUser: coupon.usageLimitPerUser,
      startDate: coupon.startDate,
      endDate: coupon.endDate,
      isActive: coupon.isActive,
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
    };

    await redis.setEx(`coupon:${couponId}`, 3600, JSON.stringify(couponCacheData));
    await redis.setEx(`coupon:code:${coupon.code}`, 3600, JSON.stringify(couponCacheData));
    //console.log('🗂️ Redis cache updated for coupon:', couponId);

    return res.status(201).json({
      success: true,
      message: ' Coupon created successfully',
      data: { coupon },
      err: {},
    });
  } catch (err) {
    console.error('❌ Create Coupon Error:', err);
    if (
      err.message.includes('required') ||
      err.message.includes('already exists') ||
      err.message.includes('Invalid')
    ) {
      return res.status(400).json({
        success: false,
        message: err.message,
        data: {},
        err: { message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const getCouponById = async (req, res) => {
  try {
    //console.log('📩 Request Params getCouponById:', req.params);

    const { id } = req.params;
    if (!id) {
      
      return res.status(400).json({
        success: false,
        message: 'Coupon ID is required',
        data: {},
        err: { message: 'Missing coupon ID parameter' },
      });
    }

    const redis = await initRedis();
    const cachedCoupon = await redis.get(`coupon:${id}`);
    if (cachedCoupon) {
      //console.log('🚀 Coupon data retrieved from Redis cache');
      const couponData = JSON.parse(cachedCoupon);
      return res.status(200).json({
        success: true,
        message: '✅ Coupon retrieved successfully',
        data: { coupon: couponData },
        err: {},
      });
    }

    const coupon = await couponService.getById(id);
    const couponCacheData = {
      _id: coupon._id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountAmount: coupon.discountAmount,
      discountPercent: coupon.discountPercent,
      maxDiscountValue: coupon.maxDiscountValue,
      minOrderAmount: coupon.minOrderAmount,
      usageLimit: coupon.usageLimit,
      usageLimitPerUser: coupon.usageLimitPerUser,
      startDate: coupon.startDate,
      endDate: coupon.endDate,
      isActive: coupon.isActive,
      applicableCourses: coupon.applicableCourses,
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
    };

    await redis.setEx(`coupon:${id}`, 3600, JSON.stringify(couponCacheData));
    //console.log('🗂️ Coupon data cached in Redis:', id);

    return res.status(200).json({
      success: true,
      message: '✅ Coupon retrieved successfully',
      data: { coupon },
      err: {},
    });
  } catch (err) {
    console.error('❌ Get Coupon By ID Error:', err);
    if (err.message === 'Coupon not found') {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
        data: {},
        err: { message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

// controller/couponController.js
export const getAllCoupons = async (req, res) => {
  try {
    const { result: coupons, total, page, limit, totalPages } =
      await couponService.getAll(req.query);

    return res.status(200).json({
      success: true,
      message: "✅ Coupons retrieved successfully",
      data: { coupons, total, page, limit, totalPages },
      err: {},
    });
  } catch (err) {
    console.error("❌ Get All Coupons Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch coupons",
      data: {},
      err: err.message,
    });
  }
};


export const updateCoupon = async (req, res) => {
  try {
    //console.log('📩 Request Body updateCoupon:', req.body);

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Coupon ID is required',
        data: {},
        err: { message: 'Missing coupon ID parameter' },
      });
    }

    const updatedCoupon = await couponService.updateById(id, req.body);

    const redis = await initRedis();
    const couponId = updatedCoupon._id.toString();
    const couponCacheData = {
      _id: updatedCoupon._id,
      code: updatedCoupon.code,
      description: updatedCoupon.description,
      discountType: updatedCoupon.discountType,
      discountAmount: updatedCoupon.discountAmount,
      discountPercent: updatedCoupon.discountPercent,
      maxDiscountValue: updatedCoupon.maxDiscountValue,
      minOrderAmount: updatedCoupon.minOrderAmount,
      usageLimit: updatedCoupon.usageLimit,
      usageLimitPerUser: updatedCoupon.usageLimitPerUser,
      startDate: updatedCoupon.startDate,
      endDate: updatedCoupon.endDate,
      isActive: updatedCoupon.isActive,
      applicableCourses: updatedCoupon.applicableCourses,
      createdAt: updatedCoupon.createdAt,
      updatedAt: updatedCoupon.updatedAt,
    };

    await redis.setEx(`coupon:${couponId}`, 3600, JSON.stringify(couponCacheData));
    await redis.setEx(`coupon:code:${updatedCoupon.code}`, 3600, JSON.stringify(couponCacheData));
    //console.log('🗂️ Redis cache updated for coupon:', couponId);

    return res.status(200).json({
      success: true,
      message: '✅ Coupon updated successfully',
      data: { coupon: updatedCoupon },
      err: {},
    });
  } catch (err) {
    console.error('❌ Update Coupon Error:', err);
    if (
      err.message === 'Coupon not found' ||
      err.message === 'No valid fields to update' ||
      err.message.includes('already exists') ||
      err.message.includes('Invalid')
    ) {
      return res.status(400).json({
        success: false,
        message: err.message,
        data: {},
        err: { message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    //console.log('📩 Request Params deleteCoupon:', req.params);

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Coupon ID is required',
        data: {},
        err: { message: 'Missing coupon ID parameter' },
      });
    }

    const deletedCoupon = await couponService.softDeleteById(id);

    const redis = await initRedis();
    await redis.del(`coupon:${id}`);
    await redis.del(`coupon:code:${deletedCoupon.code}`);
    //console.log('🗑️ Coupon cache cleared:', id);

    return res.status(200).json({
      success: true,
      message: '✅ Coupon deleted successfully',
      data: { coupon: deletedCoupon },
      err: {},
    });
  } catch (err) {
    console.error('❌ Delete Coupon Error:', err);
    if (err.message === 'Coupon not found') {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
        data: {},
        err: { message: err.message },
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message,
      data: {},
      err: err.message,
    });
  }
};

export const applyCoupon = async (req, res) => {
  try {
    //console.log('📩 Request Body applyCoupon:', req.body);
    
    const { code, orderAmount, email, courseId } = req.body;
   

    if (!code || !orderAmount) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code and order amount are required',
        data: {},
        err: { message: 'Missing required parameters' },
      });
    }

    const result = await couponService.applyCoupon(code, orderAmount, email, courseId);

    return res.status(200).json({
      success: true,
      message: '✅ Coupon applied successfully',
      data: result,
      err: {},
    });
  } catch (err) {
    console.error('❌ Apply Coupon Error:', err);
    return res.status(400).json({
      success: false,
      message: err.message,
      data: {},
      err: { message: err.message },
    });
  }
};

export const validateCoupon = async (req, res) => {
  try {
    //console.log('📩 Request Body validateCoupon:', req.body);
    
    const { code, orderAmount, courseId } = req.body;
    const userId = req.user._id;
    const email = req.user.email;

    if (!code || !orderAmount) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code and order amount are required',
        data: {},
        err: { message: 'Missing required parameters' },
      });
    }

    const result = await couponService.validateCoupon(code, orderAmount, email, courseId);

    return res.status(200).json({
      success: true,
      message: '✅ Coupon validated successfully',
      data: result,
      err: {},
    });
  } catch (err) {
    console.error('❌ Validate Coupon Error:', err);
    return res.status(400).json({
      success: false,
      message: err.message,
      data: {},
      err: { message: err.message },
    });
  }
};
