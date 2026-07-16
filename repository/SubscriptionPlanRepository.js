import SubscriptionPlan from "../models/SubscriptionPlan.js";

class SubscriptionPlanRepository {
  async create(data) {
    return await SubscriptionPlan.create(data);
  }
  async findAll(filter = {}) {
    return await SubscriptionPlan.find(filter);
  }
  async findById(id) {
    return await SubscriptionPlan.findById(id);
  }
  async updateById(id, data) {
    return await SubscriptionPlan.findByIdAndUpdate(id, data, { new: true });
  }
  async deleteById(id) {
    return await SubscriptionPlan.findByIdAndDelete(id);
  }
}

export default SubscriptionPlanRepository;
