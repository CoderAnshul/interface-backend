import EventService from '../service/EventService.js';
// import getRazorpayInstance from '../config/razorpay.js';
import { getCashfreeHeaders, getCashfreeBaseUrl } from "../config/cashfree.js";
import axiosCf from 'axios';
import Setting from '../models/setting.js';
import User from '../models/user.js';
import Event from '../models/Event.js';

const eventService = new EventService();

export const createEvent = async (req, res) => {
  try {
    // Parse venue data if it's sent as a string
    let venueData = req.body.venue;
    let tags = req.body.tags;
    let price = req.body.price;

    // Handle price parsing
    try {
      price = typeof price === 'string' ? parseFloat(price) : price;
      if (isNaN(price)) price = 0;
    } catch (e) {
      console.error('Failed to parse price:', e);
      price = 0;
    }

    // Handle venue parsing
    try {
      venueData = typeof venueData === 'string' ? JSON.parse(venueData) : venueData;
    } catch (e) {
      console.error('Failed to parse venue data:', e);
      venueData = null;
    }

    // Handle tags parsing
    try {
      if (typeof tags === 'string') {
        // First try to parse the string
        tags = JSON.parse(tags);
        // If it's already an array in string form, parse it again
        if (typeof tags === 'string') {
          tags = JSON.parse(tags);
        }
        // Ensure it's a flat array
        tags = tags.flat().map(tag => tag.replace(/[\[\]"]/g, ''));
      }
    } catch (e) {
      console.error('Failed to parse tags:', e);
      tags = [];
    }

    const eventData = {
      ...req.body,
      organizer: req.user._id,
      venue: venueData,
      tags: Array.isArray(tags) ? tags : [tags].filter(Boolean),
      price: price
    };

    // Handle file uploads
    if (req.files?.thumbnail) {
      eventData.thumbnail = req.files.thumbnail[0].path.replace(/\\/g, '/');
    }
    if (req.files?.attachments) {
      eventData.attachments = req.files.attachments.map(file => ({
        name: file.originalname,
        url: file.path.replace(/\\/g, '/'),
        type: file.mimetype
      }));
    }

    const event = await eventService.create(eventData);
    //console.log('Created event:', event); // Add logging to verify data

    return res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: event
    });
  } catch (error) {
    console.error('Event creation error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: error
    });
  }
};

export const getAllEvents = async (req, res) => {
  try {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      search,
      type,
      category,
      status,
      startDate,
      endDate
    } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (startDate) filter.startDate = startDate;
    if (endDate) filter.endDate = endDate;

    const options = {
      page,
      limit,
      sortBy,
      sortOrder,
      filter,
      search
    };

    const events = await eventService.getAll(options);
    return res.status(200).json({
      success: true,
      message: 'Events retrieved successfully',
      data: events
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      error: error
    });
  }
};

export const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await eventService.getById(id);
    return res.status(200).json({
      success: true,
      message: 'Event retrieved successfully',
      data: event
    });
  } catch (error) {
    return res.status(error.message === 'Event not found' ? 404 : 500).json({
      success: false,
      message: error.message,
      error: error
    });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Handle nested objects
    try {
      // Parse onlineLink
      if (updateData['onlineLink.url']) {
        updateData.onlineLink = {
          platform: updateData['onlineLink.platform'] || 'other',
          url: updateData['onlineLink.url'],
          meetingId: updateData['onlineLink.meetingId'] || '',
          password: updateData['onlineLink.password'] || ''
        };
        // Remove individual fields
        delete updateData['onlineLink.url'];
        delete updateData['onlineLink.platform'];
        delete updateData['onlineLink.meetingId'];
        delete updateData['onlineLink.password'];
      }

      // Parse venue
      if (typeof updateData.venue === 'string') {
        updateData.venue = JSON.parse(updateData.venue);
      }

      // Handle price
      if (updateData.price) {
        updateData.price = typeof updateData.price === 'string' ?
          parseFloat(updateData.price) : updateData.price;
      }
    } catch (e) {
      console.error('Failed to parse nested objects:', e);
    }

    // Handle file uploads
    if (req.files?.thumbnail) {
      updateData.thumbnail = req.files.thumbnail[0].path.replace(/\\/g, '/');
    }
    if (req.files?.attachments) {
      updateData.attachments = req.files.attachments.map(file => ({
        name: file.originalname,
        url: file.path.replace(/\\/g, '/'),
        type: file.mimetype
      }));
    }

    const event = await eventService.update(id, updateData);
    return res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: event
    });
  } catch (error) {
    return res.status(error.message === 'Event not found' ? 404 : 500).json({
      success: false,
      message: error.message,
      error: error
    });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    await eventService.delete(id);
    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    return res.status(error.message === 'Event not found' ? 404 : 500).json({
      success: false,
      message: error.message,
      error: error
    });
  }
};

//checkRegisterForEvent
export const checkRegisterForEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { guestEmail, guestName, is_verify, paymentProvider } = req.body; // Added paymentProvider to destructured request body

    if (!guestEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
        is_valid: false
      });
    }

    // Check if user exists and is already verified
    const existingUserRecord = await User.findOne({ email: guestEmail });
    const isActuallyVerified = existingUserRecord && existingUserRecord.is_verify === true;

    if (!is_verify && !isActuallyVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email not verified',
        is_valid: false,
        err: { email: 'Please verify your email before proceeding' }
      });
    }

    const event = await Event.findOne({ _id: id, isDeleted: false });
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
        is_valid: false
      });
    }

    // Check if event already started
    if (new Date(event.startDate) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Event has already started',
        is_valid: false
      });
    }

    // Check if event is ended
    if (new Date(event.endDate) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Event has already ended',
        is_valid: false
      });
    }

    // Calculate total amount based on event price
    let amount = 0;
    let total = 0;
    if (event.price) {
      amount = parseFloat(event.price.toString());
      if (amount > 0) {
        const GST_RATE = await Setting.getGstRate();
        const tax = parseFloat((amount * GST_RATE).toFixed(2));
        total = parseFloat(amount) + parseFloat(tax);
      }
    }

    // Check registration status
    let guestUser = await User.findOne({ email: guestEmail });
    if (guestUser) {
      // Check if is_verify is explicitly true for existing users
      if (is_verify !== true) {
        return res.status(400).json({
          success: false,
          message: 'Email not verified',
          is_valid: false,
          err: { email: 'Please verify your email before proceeding' }
        });
      }

      const userId = guestUser._id;
      const existingParticipant = event.registeredParticipants.find(
        p => p.userId.toString() === userId.toString()
      );

      if (existingParticipant) {
        // Guard against duplicate manual payments
        if (paymentProvider === 'manual' && existingParticipant.paymentStatus === 'pending') {
          return res.status(400).json({
            success: false,
            message: 'Your payment is already pending. Please wait for admin approval.',
            is_valid: false
          });
        }

        // If not a pending manual payment, treat as already registered
        return res.status(400).json({
          success: false,
          message: 'User already registered for the event',
          is_valid: false
        });
      }
    }

    if (amount > 0) {
      if (paymentProvider === 'manual') {
        // Skip payment gateway, directly return success for manual payment
        return res.status(200).json({
          success: true,
          is_valid: true,
          manual: true,
          data: { message: 'Manual payment selected, proceed to registration' }
        });
      }
      // ── Cashfree: Create a payment session ───────────────────────────────
      let cfHeaders, cfBaseUrl;
      try {
        cfHeaders = await getCashfreeHeaders();
        cfBaseUrl = getCashfreeBaseUrl();
      } catch (cfConfigError) {
        return res.status(500).json({
          message: "Payment gateway configuration error",
          error: cfConfigError.message,
          is_valid: false
        });
      }

      const cashfreeOrderId = `event_${id}_${Date.now()}`;

      const cashfreePayload = {
        order_id: cashfreeOrderId,
        order_amount: total,
        order_currency: 'INR',
        customer_details: {
          customer_id: guestUser ? guestUser._id.toString() : `guest_${Date.now()}`,
          customer_name: guestName || 'Guest User',
          customer_email: guestEmail,
          customer_phone: req.body.phone || '9999999999',
        },
        order_meta: {
          return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-success?order_id={order_id}&event_id=${id}`,
        }
      };

      try {
        const cfResponse = await axiosCf.post(`${cfBaseUrl}/orders`, cashfreePayload, { headers: cfHeaders });

        if (cfResponse.data && cfResponse.data.payment_session_id) {
          return res.status(200).json({
            success: true,
            is_valid: true,
            cashfree: {
              order_id: cfResponse.data.order_id,
              payment_session_id: cfResponse.data.payment_session_id,
              order_status: cfResponse.data.order_status,
              order_amount: cfResponse.data.order_amount,
              order_currency: cfResponse.data.order_currency,
            },
            data: { message: 'Cashfree session created for event' }
          });
        }
        return res.status(400).json({ message: "Failed to create Cashfree session", is_valid: false });
      } catch (cfApiError) {
        console.error("Cashfree API Error:", cfApiError.response?.data || cfApiError.message);
        return res.status(500).json({
          message: "Payment gateway error",
          error: cfApiError.response?.data || cfApiError.message,
          is_valid: false
        });
      }
    } else {
      return res.status(200).json({
        success: true,
        message: 'User can register for the event',
        is_valid: true
      });
    }
  } catch (error) {
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message,
      is_valid: false,
      error: error
    });
  }
};

export const registerForEvent = async (req, res) => {
  try {
    const { id } = req.params;

    //console.log("Request body for event registration:", req.body);




    // //console.log("Registering for event:", id, "with data:", data);
    const event = await eventService.registerParticipant(id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Successfully registered for event',
      data: event
    });
  } catch (error) {
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message,
      error: error
    });
  }
};

export const updateParticipantStatus = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { status } = req.body;

    if (!['registered', 'attended', 'cancelled', 'waitlisted'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const event = await eventService.updateParticipantStatus(id, userId, status);
    return res.status(200).json({
      success: true,
      message: 'Participant status updated successfully',
      data: event
    });
  } catch (error) {
    return res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message,
      error: error
    });
  }
};

export const approveManualEventPayment = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const event = await Event.findOne({ _id: id, isDeleted: false });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const participant = event.registeredParticipants.find(
      p => p.userId.toString() === userId.toString()
    );

    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant not found in this event' });
    }

    if (participant.paymentStatus === 'completed') {
      return res.status(400).json({ success: false, message: 'Payment is already completed' });
    }

    participant.paymentStatus = 'completed';
    await event.save();

    // Send confirmation email
    try {
      const guestUser = await User.findById(userId);
      if (guestUser) {
        const emailService = (await import('../utils/emailService.js')).default;
        await emailService.sendEventRegistrationEmail(
          guestUser.email,
          guestUser.fullName || 'User',
          event,
          "student" // Assuming they are student
        );
      }
    } catch (emailError) {
      console.error("❌ Email sending failed after manual approval:", emailError);
    }

    return res.status(200).json({
      success: true,
      message: 'Manual payment approved successfully, registration confirmed',
    });
  } catch (error) {
    console.error('approveManualEventPayment error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: error
    });
  }
};