import NewsRepository from '../repository/newsRepository.js';
import mongoose from 'mongoose';
import News from '../models/News.js';

class NewsService {
  async create(newsData) {
    try {
      // Generate slug if not provided
      if (!newsData.slug && newsData.title) {
        newsData.slug = this.generateSlug(newsData.title);
      }

      // Ensure fetchedAt is set
      if (!newsData.fetchedAt) {
        newsData.fetchedAt = new Date();
      }

      return await NewsRepository.create(newsData);
    } catch (error) {
      console.error('NewsService.create error:', error);
      throw error;
    }
  }

  async getAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'publishedAt',
        sortOrder = 'desc',
        filter = {},
        search,
        category,
        state,
        city,
        tag,
        language,
        country,
        isBreaking,
        breakingNews,
        status = 'active',
        live,
        Live,
        Top,
        topNews,
        trendingTopic,
      } = options;

      // Build query
      const query = { ...filter };

      if (status) {
        query.status = status;
      }

      if (category) {
        // Support both string and ObjectId
        const categoryValue = mongoose.Types.ObjectId.isValid(category)
          ? new mongoose.Types.ObjectId(category)
          : category;
        query.$or = [
          { categories: { $in: [categoryValue] } },
          { category: categoryValue },
        ];
      }

      if (state) {
        const stateValue = mongoose.Types.ObjectId.isValid(state)
          ? new mongoose.Types.ObjectId(state)
          : state;
        query.state = stateValue;
      }

      if (city) {
        const cityValue = mongoose.Types.ObjectId.isValid(city)
          ? new mongoose.Types.ObjectId(city)
          : city;
        query.city = cityValue;
      }

      if (tag) {
        query.tags = { $in: [tag] };
      }

      if (language) {
        query.language = language;
      }

      if (country) {
        query.country = country;
      }

      if (isBreaking !== undefined || breakingNews !== undefined) {
        const breakingValue = isBreaking === 'true' || isBreaking === true ||
          breakingNews === 'true' || breakingNews === true;
        query.$or = [
          { isBreaking: breakingValue },
          { breakingNews: breakingValue },
        ];
      }

      if (live !== undefined || Live !== undefined) {
        const liveValue = live === 'true' || live === true ||
          Live === 'true' || Live === true;
        query.Live = liveValue;
      }

      if (Top !== undefined || topNews !== undefined) {
        const topValue = Top === 'true' || Top === true ||
          topNews === 'true' || topNews === true;
        query.$or = [
          { Top: topValue },
          { topNews: topValue },
        ];
      }

      if (trendingTopic !== undefined) {
        query.trendingTopic = trendingTopic === 'true' || trendingTopic === true;
      }

      // Text search - use regex if text index not available
      if (search) {
        try {
          query.$text = { $search: search };
        } catch (e) {
          // Fallback to regex search if text index not available
          const searchRegex = new RegExp(search, 'i');
          query.$or = [
            { title: searchRegex },
            { articleTitle: searchRegex },
            { en_articleTitle: searchRegex },
            { summary: searchRegex },
            { excerpt: searchRegex },
            { content: searchRegex },
          ];
        }
      }

      // Sort
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // If text search, add text score to sort
      if (search) {
        sort.score = { $meta: 'textScore' };
      }

      const news = await NewsRepository.findAll({
        query,
        sort,
        skip: (page - 1) * limit,
        limit: parseInt(limit),
      });

      const total = await NewsRepository.count(query);

      return {
        data: this.parseContent(news),
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('NewsService.getAll error:', error);
      throw error;
    }
  }


  async getDistinctCategories() {
    return await News.distinct("categories").exec();
  }

  async getById(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid news ID');
      }
      const news = await NewsRepository.findById(id);
      if (!news) throw new Error('News not found');

      return this.parseContent(news);
    } catch (error) {
      console.error('NewsService.getById error:', error);
      throw error;
    }
  }

  async getBySlug(slug) {
    try {
      const news = await NewsRepository.findBySlug(slug);
      if (!news) throw new Error('News not found');

      return this.parseContent(news);
    } catch (error) {
      console.error('NewsService.getBySlug error:', error);
      throw error;
    }
  }

  async update(id, updateData) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid news ID');
      }

      // Generate slug if title is being updated
      if (updateData.title && !updateData.slug) {
        updateData.slug = this.generateSlug(updateData.title);
      }

      const news = await NewsRepository.update(id, updateData);
      if (!news) throw new Error('News not found');
      return news;
    } catch (error) {
      console.error('NewsService.update error:', error);
      throw error;
    }
  }

  async delete(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid news ID');
      }
      const news = await NewsRepository.delete(id);
      if (!news) throw new Error('News not found');
      return news;
    } catch (error) {
      console.error('NewsService.delete error:', error);
      throw error;
    }
  }

  async search(searchText, options = {}) {
    try {
      const { limit = 20, status } = options;
      const results = await NewsRepository.search(searchText, { status });
      return results.slice(0, limit);
    } catch (error) {
      console.error('NewsService.search error:', error);
      throw error;
    }
  }

  async incrementViews(id) {
    try {
      return await NewsRepository.incrementStats(id, 'views');
    } catch (error) {
      console.error('NewsService.incrementViews error:', error);
      throw error;
    }
  }

  async incrementLikes(id) {
    try {
      return await NewsRepository.incrementStats(id, 'likes');
    } catch (error) {
      console.error('NewsService.incrementLikes error:', error);
      throw error;
    }
  }

  async incrementShares(id) {
    try {
      return await NewsRepository.incrementStats(id, 'shares');
    } catch (error) {
      console.error('NewsService.incrementShares error:', error);
      throw error;
    }
  }

  async trackUserInteraction(id, interactionType, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid news ID');
      }
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID');
      }
      if (!['views', 'likes', 'shares'].includes(interactionType)) {
        throw new Error('Invalid interaction type. Must be views, likes, or shares');
      }
      return await NewsRepository.trackUserInteraction(id, interactionType, userId);
    } catch (error) {
      console.error('NewsService.trackUserInteraction error:', error);
      throw error;
    }
  }

  async removeUserInteraction(id, interactionType, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid news ID');
      }
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID');
      }
      if (!['likes', 'shares'].includes(interactionType)) {
        throw new Error('Invalid interaction type. Can only remove likes or shares');
      }
      return await NewsRepository.removeUserInteraction(id, interactionType, userId);
    } catch (error) {
      console.error('NewsService.removeUserInteraction error:', error);
      throw error;
    }
  }

  async getUserInteractions(id, interactionType, options = {}) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid news ID');
      }
      if (!['views', 'likes', 'shares'].includes(interactionType)) {
        throw new Error('Invalid interaction type. Must be views, likes, or shares');
      }
      return await NewsRepository.getUserInteractions(id, interactionType, options);
    } catch (error) {
      console.error('NewsService.getUserInteractions error:', error);
      throw error;
    }
  }

  async checkUserInteraction(id, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid news ID');
      }
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user ID');
      }
      return await NewsRepository.checkUserInteraction(id, userId);
    } catch (error) {
      console.error('NewsService.checkUserInteraction error:', error);
      throw error;
    }
  }

  async populateUserInteractions(news) {
    try {
      return await NewsRepository.populateUserInteractions(news);
    } catch (error) {
      console.error('NewsService.populateUserInteractions error:', error);
      return news; // Return original news if population fails
    }
  }

  async addComment(id, userId, comment) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid news ID');
      }

      // Use Mongoose model directly to get document instance
      const news = await News.findById(id);
      if (!news) throw new Error('News not found');

      const newComment = {
        user: userId,
        text: comment,
        createdAt: new Date(),
      };

      news.comments.push(newComment);
      await news.save();

      // Populate user details for the new comment
      const result = await News.findById(id).populate("comments.user", "fullName email profilePicture").lean();
      return this.parseContent(result);
    } catch (error) {
      console.error('NewsService.addComment error:', error);
      throw error;
    }
  }

  async addReply(newsId, commentId, userId, text) {
    try {
      if (!mongoose.Types.ObjectId.isValid(newsId)) {
        throw new Error('Invalid news ID');
      }
      if (!mongoose.Types.ObjectId.isValid(commentId)) {
        throw new Error('Invalid comment ID');
      }

      const news = await News.findById(newsId);
      if (!news) throw new Error('News not found');

      const comment = news.comments.id(commentId);
      if (!comment) throw new Error('Comment not found');

      const newReply = {
        user: userId,
        text,
        createdAt: new Date(),
      };

      comment.replies.push(newReply);
      await news.save();

      // Populate user details including replies
      const result = await NewsRepository.findById(newsId);
      return await NewsRepository.populateUserInteractions(result);
    } catch (error) {
      console.error('NewsService.addReply error:', error);
      throw error;
    }
  }

  async deleteComment(newsId, commentId, userId, userRole) {
    try {
      if (!mongoose.Types.ObjectId.isValid(newsId)) {
        throw new Error('Invalid news ID');
      }
      if (!mongoose.Types.ObjectId.isValid(commentId)) {
        throw new Error('Invalid comment ID');
      }

      const news = await News.findById(newsId);
      if (!news) throw new Error('News not found');

      const comment = news.comments.id(commentId);
      if (!comment) throw new Error('Comment not found');

      // Check permissions: User must be author OR admin
      const isAuthor = comment.user.toString() === userId.toString();
      const isAdmin = userRole === 'admin';

      if (!isAuthor && !isAdmin) {
        throw new Error('Unauthorized to delete this comment');
      }

      // Use pull to remove the subdocument
      news.comments.pull(commentId);
      await news.save();

      // Return updated news with populated fields
      const result = await NewsRepository.findById(newsId);
      return await NewsRepository.populateUserInteractions(result);
    } catch (error) {
      console.error('NewsService.deleteComment error:', error);
      throw error;
    }
  }

  async getComments(newsId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(newsId)) {
        throw new Error('Invalid news ID');
      }

      const news = await NewsRepository.findById(newsId);
      if (!news) throw new Error('News not found');

      const populatedNews = await NewsRepository.populateUserInteractions(news);

      // Sort comments by date (newest first)
      const comments = populatedNews.comments || [];
      comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return comments;
    } catch (error) {
      console.error('NewsService.getComments error:', error);
      throw error;
    }
  }

  // Helper to parse content JSON string if needed
  parseContent(newsItem) {
    if (!newsItem) return newsItem;

    // Handle array of news
    if (Array.isArray(newsItem)) {
      return newsItem.map(item => this.parseContent(item));
    }

    // Handle single news object
    if (newsItem.content && typeof newsItem.content === 'string') {
      try {
        // Check if it looks like a JSON object or array
        if (newsItem.content.trim().startsWith('{') || newsItem.content.trim().startsWith('[')) {
          const parsed = JSON.parse(newsItem.content);
          // If double stringified, parse again (just in case)
          if (typeof parsed === 'string') {
            try {
              newsItem.content = JSON.parse(parsed);
            } catch (e) {
              newsItem.content = parsed;
            }
          } else {
            newsItem.content = parsed;
          }
        }
      } catch (e) {
        // Keep original if parse fails
        console.warn('Failed to parse news content JSON:', e);
      }
    }
    return newsItem;
  }

  generateSlug(title) {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      + '-' + Date.now().toString(36);
  }
}

export default new NewsService();

