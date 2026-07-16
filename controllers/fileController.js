import fileService from "../service/file-service.js";
import { initRedis } from "../config/redisClient.js";

export const createFile = async (req, res) => {
  //console.log("Creating file with data:", req.body);
  try {
    const {
      language,
      fileType,
      downloadable,
      active,
      isPublic,
      lessonId,
      courseId,
    } = req.body;
    const filePath = req.file?.path;

    const file = await fileService.createFile({
      lessonId,
      courseId,
      language,
      fileType,
      filePath,
      downloadable,
      active,
      isPublic,
    });

    //console.log("File created with data:", file);
    const redis = await initRedis();
    await redis.del("files:all*");

    res
      .status(201)
      .json({ success: true, message: "File created", data: file });
  } catch (err) {
    //console.log("Error creating file:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getFiles = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sortBy = "createdAt",
      sortOrder = "asc",
      courseId,
      lessonId,
    } = req.query;

    const filters = {};
    if (courseId) filters.courseId = courseId;
    if (lessonId) filters.lessonId = lessonId;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      sortBy,
      sortOrder,
      filters,
    };

    const cacheKey = `files:all:${JSON.stringify(options)}`;
    const redis = await initRedis();
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        message: "Files from cache",
        ...JSON.parse(cached),
        fromCache: true,
      });
    }

    const files = await fileService.getAllFiles(options);
    await redis.setEx(cacheKey, 300, JSON.stringify(files));

    res.status(200).json({ success: true, message: "Files fetched", ...files });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getFileById = async (req, res) => {
  try {
    const { id } = req.params;

    const redis = await initRedis();
    const cached = await redis.get(`file:${id}`);

    if (cached) {
      return res.status(200).json({
        success: true,
        message: "File from cache",
        data: JSON.parse(cached),
        fromCache: true,
      });
    }

    //console.log("Fetching file with ID:", id);

    const file = await fileService.getFile(id);
    if (!file)
      return res
        .status(404)
        .json({ success: false, message: "File not found" });

    await redis.setEx(`file:${id}`, 300, JSON.stringify(file));

    res
      .status(200)
      .json({ success: true, message: "File fetched", data: file });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateFile = async (req, res) => {
  try {
    //console.log("Updating file with data:", req.body);
    const { id } = req.params;

    const file = await fileService.updateFile(id, req.body);
    if (!file)
      return res
        .status(404)
        .json({ success: false, message: "File not found" });

    const redis = await initRedis();
    await redis.del("files:all*");
    await redis.del(`file:${id}`);

    res
      .status(200)
      .json({ success: true, message: "File updated", data: file });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteFile = async (req, res) => {
  try {
    const { id } = req.params;

    const file = await fileService.deleteFile(id);
    if (!file)
      return res
        .status(404)
        .json({ success: false, message: "File not found" });

    const redis = await initRedis();
    await redis.del("files:all*");
    await redis.del(`file:${id}`);

    res
      .status(200)
      .json({ success: true, message: "File deleted", data: file });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
