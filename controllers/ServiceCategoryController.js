import ServiceCategoryService from '../service/ServiceCategoryService.js';

const service = new ServiceCategoryService();

export const createServiceCategory = async (req, res) => {
  try {
    const category = await service.create(req.body);
    res.status(201).json({ success: true, message: 'Service category created', data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllServiceCategories = async (req, res) => {
  try {
    const isAdmin = req.query.admin === 'true';
    const categories = isAdmin ? await service.getAllAdmin() : await service.getAll();
    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getServiceCategoryById = async (req, res) => {
  try {
    const category = await service.getById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Not found' });
    res.status(200).json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateServiceCategory = async (req, res) => {
  try {
    const updated = await service.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    res.status(200).json({ success: true, message: 'Updated', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteServiceCategory = async (req, res) => {
  try {
    const deleted = await service.delete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
    res.status(200).json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
