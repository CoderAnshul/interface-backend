import ServiceCategory from '../models/ServiceCategory.js';

export default class ServiceCategoryRepository {
  async create(data) {
    return await ServiceCategory.create(data);
  }

  async findAll() {
    return await ServiceCategory.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
  }

  async findAllAdmin() {
    return await ServiceCategory.find().sort({ order: 1, createdAt: 1 });
  }

  async findById(id) {
    return await ServiceCategory.findById(id);
  }

  async update(id, data) {
    return await ServiceCategory.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async delete(id) {
    return await ServiceCategory.findByIdAndDelete(id);
  }
}
