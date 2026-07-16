import EbookRepository from "../repository/EbookRepository.js";
import slugify from "slugify";
import CourseCategory from "../models/CourseCategory.js";
import SubCategory from "../models/SubCategory.js";
import mongoose from "mongoose";

class EbookService {
    constructor() {
        this.repository = new EbookRepository();
    }

    async generateUniqueSlug(title, excludeId = null) {
        try {
            const baseSlug = slugify(title, { lower: true, strict: true });
            let slug = baseSlug;
            let counter = 1;

            while (true) {
                const existing = await this.repository.findBySlug(slug);
                if (!existing || (excludeId && existing._id.toString() === excludeId)) {
                    return slug;
                }
                slug = `${baseSlug}-${counter}`;
                counter++;
            }
        } catch (error) {
            throw new Error("Error generating unique slug");
        }
    }

    async create(data) {
        try {
            if (!data.title) throw new Error("Title is required");

            if (data.categoryId) {
                const category = await CourseCategory.findById(data.categoryId);
                if (!category) throw new Error("Invalid category");
            }

            const slug = await this.generateUniqueSlug(data.title);
            return await this.repository.create({ ...data, slug });
        } catch (error) {
            throw error;
        }
    }

    async getAll(options) {
        try {
            return await this.repository.findAll(options);
        } catch (error) {
            throw error;
        }
    }

    async getById(id) {
        try {
            const ebook = await this.repository.get(id, ["categoryId", "subCategoryId"]);
            if (!ebook || ebook.isDeleted) throw new Error("Ebook not found");
            return ebook;
        } catch (error) {
            throw error;
        }
    }

    async getBySlug(slug) {
        try {
            const ebook = await this.repository.findBySlug(slug);
            if (!ebook) throw new Error("Ebook not found");
            return ebook;
        } catch (error) {
            throw error;
        }
    }

    async update(id, data) {
        try {
            if (data.title) {
                data.slug = await this.generateUniqueSlug(data.title, id);
            }
            const updated = await this.repository.update(id, data);
            if (!updated) throw new Error("Ebook not found");
            return updated;
        } catch (error) {
            throw error;
        }
    }

    async softDelete(id) {
        try {
            return await this.repository.update(id, { isDeleted: true, deletedAt: new Date() });
        } catch (error) {
            throw error;
        }
    }

    // Business logic for download access
    async getDownloadUrl(ebookId, user) {
        try {
            const ebook = await this.getById(ebookId);

            if (ebook.isFree) {
                return ebook.fullFile;
            }

            // Check if user is admin or instructor (they have access)
            if (user && (user.roles === 'admin' || user.roles === 'instructor')) {
                return ebook.fullFile;
            }

            // Check if user has purchased this ebook
            if (user && user._id) {
                const Order = (await import("../models/Order.js")).default;
                const purchase = await Order.findOne({
                    userId: user._id,
                    "items.ebookId": ebookId,
                    "payment.status": "paid"
                });

                if (purchase) {
                    return ebook.fullFile;
                }
            }

            // If not free and no purchase found, throw error
            throw new Error("Payment required to download this ebook");
        } catch (error) {
            throw error;
        }
    }
}

export default EbookService;

