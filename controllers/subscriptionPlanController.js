import SubscriptionPlanService from "../service/SubscriptionPlanService.js";
const service = new SubscriptionPlanService();

export const createSubscriptionPlan = async (req, res) => {
  try {
    const plan = await service.create(req.body);
    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

export const getAllSubscriptionPlans = async (req, res) => {
  try {
    const plans = await service.getAll();
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getSubscriptionPlanById = async (req, res) => {
  try {
    const plan = await service.getById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const updateSubscriptionPlan = async (req, res) => {
  try {
    const plan = await service.updateById(req.params.id, req.body);
    if (!plan) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

export const deleteSubscriptionPlan = async (req, res) => {
  try {
    const plan = await service.deleteById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
