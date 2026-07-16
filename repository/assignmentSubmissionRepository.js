
import AssignmentSubmission from "../models/assignmentSubmission.js";
import mongoose from 'mongoose';

class AssignmentSubmissionRepository {
  async create(data) {
    try {
      const submission = new AssignmentSubmission(data);
      return await submission.save();
    } catch (error) {
      throw new Error(
        `Repository: Failed to create submission - ${error.message}`
      );
    }
  }

  //countByUserAndAssignment
  async countByUserAndAssignment(userId, assignmentId) {
    try {
      return await AssignmentSubmission.countDocuments({
        submittedBy: userId,
        assignmentId,
      });
    } catch (error) {
      throw new Error(
        `Repository: Failed to count submissions for user and assignment - ${error.message}`
      );
    }
  }

  async findAllByUser(userId) {
    try {
      return await AssignmentSubmission.find({ submittedBy: userId })
        .populate("assignmentId")
        .populate("courseId")
        .populate("lessonId");
    } catch (error) {
      throw new Error(
        `Repository: Failed to fetch user submissions - ${error.message}`
      );
    }
  }

  async findByUserAndAssignment(userId, assignmentId) {
    try {
      return await AssignmentSubmission.findOne({
        submittedBy: userId,
        assignmentId,
      })
        .populate("assignmentId")
        .populate("courseId")
        .populate("lessonId");
    } catch (error) {
      throw new Error(
        `Repository: Failed to fetch submission for assignment - ${error.message}`
      );
    }
  }

  async findAllByAssignment(assignmentId) {
    try {
      return await AssignmentSubmission.find({ assignmentId })
        .populate("submittedBy")
        .populate("courseId")
        .populate("lessonId");
    } catch (error) {
      throw new Error(
        `Repository: Failed to fetch all submissions for assignment - ${error.message}`
      );
    }
  }

  async update(id, data) {
    try {
      return await AssignmentSubmission.findByIdAndUpdate(id, data, {
        new: true,
      });
    } catch (error) {
      throw new Error(
        `Repository: Failed to update submission - ${error.message}`
      );
    }
  }

  async destroy(id) {
    try {
      return await AssignmentSubmission.findByIdAndDelete(id);
    } catch (error) {
      throw new Error(
        `Repository: Failed to delete submission - ${error.message}`
      );
    }
  }

  async findAll() {
    try {
      return await AssignmentSubmission.find({})
        .populate("submittedBy")
        .populate("assignmentId")
        .populate("courseId")
        .populate("lessonId");
    } catch (error) {
      throw new Error(
        `Repository: Failed to fetch all submissions - ${error.message}`
      );
    }
  }

 async findAllPaginated(skip = 0, limit = 10, search = "", filters = {}) {
  try {
    const { status, is_complete } = filters;

    const matchConditions = [];

    if (search && search.trim()) {
      const regex = new RegExp(search, "i");

      matchConditions.push({
        $or: [
          { "assignmentId.title": regex },
          { "courseId.title": regex },
          { "lessonId.title": regex },
          { "submittedBy.fullName": regex },
          { "submittedBy.email": regex },
        ],
      });
    }

    if (status) {
      matchConditions.push({ status });
    }

    if (typeof is_complete !== "undefined") {
      matchConditions.push({ is_complete: is_complete === "true" });
    }

    // Partner filter: if partnerId provided, match submissions whose submitter was referred by that partner
    const partnerId = filters.partnerId;
    if (partnerId) {
      try {
        matchConditions.push({ 'submittedBy.referredBy': new mongoose.Types.ObjectId(partnerId) });
      } catch (err) {
        // ignore invalid ObjectId and force no results
        matchConditions.push({ 'submittedBy.referredBy': { $in: [] } });
      }
    }

    const pipeline = [
      {
        $lookup: {
          from: "users",
          localField: "submittedBy",
          foreignField: "_id",
          as: "submittedBy",
        },
      },
      { $unwind: "$submittedBy" },

      {
        $lookup: {
          from: "assignments",
          localField: "assignmentId",
          foreignField: "_id",
          as: "assignmentId",
        },
      },
      { $unwind: "$assignmentId" },

      {
        $lookup: {
          from: "courses",
          localField: "courseId",
          foreignField: "_id",
          as: "courseId",
        },
      },
      { $unwind: "$courseId" },

      {
        $lookup: {
          from: "lessons",
          localField: "lessonId",
          foreignField: "_id",
          as: "lessonId",
        },
      },
      { $unwind: "$lessonId" },

      ...(matchConditions.length ? [{ $match: { $and: matchConditions } }] : []),

      { $sort: { createdAt: -1 } },

      {
        $facet: {
          submissions: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const result = await AssignmentSubmission.aggregate(pipeline);

    const submissions = result[0]?.submissions || [];
    const total = result[0]?.totalCount[0]?.count || 0;

    return { submissions, total };
  } catch (error) {
    throw new Error(
      `Repository: Failed to fetch paginated submissions - ${error.message}`
    );
  }
}


  async findById(id) {
    try {
      return await AssignmentSubmission.findById(id)
        .populate("submittedBy")
        .populate("assignmentId")
        .populate("courseId")
        .populate("lessonId");
    } catch (error) {
      throw new Error(
        `Repository: Failed to fetch submission by ID - ${error.message}`
      );
    }
  }
}

export default AssignmentSubmissionRepository;
