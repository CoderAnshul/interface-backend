// repository/TicketRepository.js
import SupportTicket from '../models/SupportTicket.js';
import CrudRepository from './crudRepository.js';
import mongoose from 'mongoose';

class TicketRepository extends CrudRepository {
  constructor() {
    super(SupportTicket);
  }

  async findById(id) {
    try {
      return await SupportTicket.findById(id)
        .populate('userId', 'fullName email role')
        .populate('messages.sender', 'fullName email role');
    } catch (error) {
      throw error;
    }
  }

  async findAll() {
    try {
      return await SupportTicket.find({ isDeleted: false })
        .populate('userId', 'fullName email')
        .sort({ createdAt: -1 });
    } catch (error) {
      throw error;
    }
  }

  async findAllWithPagination(queryConditions, sortConditions = {}, skip = 0, limit = 10) {
    try {
      // If referredById filter is present, include tickets where the ticket's referredById
      // matches OR the ticket's user document has `referredBy` set (i.e. user was referred)
      if (queryConditions.referredById) {
        const referredFilter = queryConditions.referredById;
        // remove from base match
        const baseMatch = { ...queryConditions };
        delete baseMatch.referredById;

        const pipeline = [
          { $match: baseMatch },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user',
            },
          },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        ];

        // Build referred match
        if (typeof referredFilter === 'object' && referredFilter.$exists) {
          // 'any' case translated earlier to { $exists: true, $ne: null }
          pipeline.push({
            $match: {
              $or: [
                { referredById: { $exists: true, $ne: null } },
                { 'user.referredBy': { $exists: true, $ne: null } },
              ],
            },
          });
        } else {
          // specific partner id
          const partnerId = new mongoose.Types.ObjectId(referredFilter.toString());
          pipeline.push({
            $match: {
              $or: [
                { referredById: partnerId },
                { 'user.referredBy': partnerId },
              ],
            },
          });
        }

        // Total count
        const countPipeline = [...pipeline, { $count: 'total' }];
        const countResult = await SupportTicket.aggregate(countPipeline);
        const total = countResult[0]?.total || 0;

        // Add sort/skip/limit
        if (Object.keys(sortConditions || {}).length > 0) {
          pipeline.push({ $sort: sortConditions });
        } else {
          pipeline.push({ $sort: { createdAt: -1 } });
        }
        if (skip) pipeline.push({ $skip: skip });
        if (limit) pipeline.push({ $limit: limit });

        // Project to include populated userId fields
        pipeline.push({
          $project: {
            _id: 1,
            userId: 1,
            subject: 1,
            category: 1,
            description: 1,
            status: 1,
            priority: 1,
            messages: 1,
            attachments: 1,
            // Prefer ticket.referredById, fallback to user.referredBy
            referredById: { $ifNull: ['$referredById', '$user.referredBy'] },
            isDeleted: 1,
            createdAt: 1,
            updatedAt: 1,
            user: { _id: '$user._id', fullName: '$user.fullName', email: '$user.email', referredBy: '$user.referredBy' },
          },
        });

        const tickets = await SupportTicket.aggregate(pipeline);

        // Convert aggregated `user` into `userId` populate-like object for compatibility
        const ticketsWithUser = tickets.map(t => {
          if (t.user) {
            t.userId = t.user;
            delete t.user;
          }
          // ensure referredById is a string or null
          if (t.referredById && typeof t.referredById !== 'string') t.referredById = t.referredById.toString();
          return t;
        });

        return { tickets: ticketsWithUser, total };
      }

      let tickets = await SupportTicket.find(queryConditions)
        .populate('userId', 'fullName email referredBy')
        .sort(sortConditions)
        .skip(skip)
        .limit(limit)
        .lean();

      // Ensure referredById exists on each ticket (fallback to populated userId.referredBy)
      tickets = tickets.map(t => {
        if ((!t.referredById || t.referredById === null) && t.userId && t.userId.referredBy) {
          t.referredById = t.userId.referredBy;
        }
        if (t.referredById && typeof t.referredById !== 'string') t.referredById = t.referredById.toString();
        return t;
      });

      const total = await SupportTicket.countDocuments(queryConditions);
      return { tickets, total };
    } catch (error) {
      throw error;
    }
  }

  async updateById(id, updateFields) {
    try {
      return await SupportTicket.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true }
      )
      .populate('userId', 'fullName email')
      .populate('messages.sender', 'fullName email role');
    } catch (error) {
      throw error;
    }
  }

  async addMessage(ticketId, messageData) {
    try {
      return await SupportTicket.findByIdAndUpdate(
        ticketId,
        { $push: { messages: messageData } },
        { new: true }
      )
      .populate('userId', 'fullName email')
      .populate('messages.sender', 'fullName email role');
    } catch (error) {
      throw error;
    }
  }

  async softDeleteById(id) {
    try {
      return await SupportTicket.findByIdAndDelete(
        id,
        { isDeleted: true },
        { new: true }
      );
    } catch (error) {
      throw error;
    }
  }

  async getTicketStats() {
    try {
      const pipeline = [
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ];
      return await SupportTicket.aggregate(pipeline);
    } catch (error) {
      throw error;
    }
  }

  async findByStatus(status) {
    try {
      return await SupportTicket.find({ status, isDeleted: false })
        .populate('userId', 'fullName email')
        .sort({ createdAt: -1 });
    } catch (error) {
      throw error;
    }
  }

  async findByCategory(category) {
    try {
      return await SupportTicket.find({ category, isDeleted: false })
        .populate('userId', 'fullName email')
        .sort({ createdAt: -1 });
    } catch (error) {
      throw error;
    }
  }
}

export default TicketRepository;
