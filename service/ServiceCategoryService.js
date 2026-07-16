import ServiceCategoryRepository from '../repository/ServiceCategoryRepository.js';

const repo = new ServiceCategoryRepository();

export default class ServiceCategoryService {
  async create(data) {
    return await repo.create(data);
  }

  async getAll() {
    return await repo.findAll();
  }

  async getAllAdmin() {
    return await repo.findAllAdmin();
  }

  async getById(id) {
    return await repo.findById(id);
  }

  async update(id, data) {
    return await repo.update(id, data);
  }

  async delete(id) {
    return await repo.delete(id);
  }
}
