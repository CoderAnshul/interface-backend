import Ebook from '../models/Ebook.js';
import CrudRepository from './crudRepository.js';

class EbookRepository extends CrudRepository {
    constructor() {
        super(Ebook);
    }

    async findAll({
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
        filter = {},
        search = "",
    } = {}) {
        try {
            const skip = (page - 1) * limit;
            let searchQuery = { isDeleted: false };

            if (search) {
                searchQuery.$or = [
                    { title: { $regex: search, $options: "i" } },
                    { description: { $regex: search, $options: "i" } },
                    { author: { $regex: search, $options: "i" } },
                ];
            }

            const query = { ...searchQuery, ...filter };
            const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

            const data = await Ebook.find(query)
                .populate("categoryId")
                .populate("subCategoryId")
                .skip(skip)
                .limit(limit)
                .sort(sortOptions);

            const total = await Ebook.countDocuments(query);

            return {
                data,
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit),
            };
        } catch (error) {
            throw error;
        }
    }

    async findBySlug(slug) {
        try {
            return await Ebook.findOne({ slug, isDeleted: false })
                .populate("categoryId")
                .populate("subCategoryId");
        } catch (error) {
            throw error;
        }
    }
}

export default EbookRepository;
