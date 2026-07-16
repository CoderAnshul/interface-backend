import Lead from '../models/Lead.js';

// Create a new lead
export const createLead = async (req, res) => {
    try {
        const partnerId = req.user._id;
        const { name, email, phone, category, notes } = req.body;

        const lead = new Lead({
            partnerId,
            name,
            email,
            phone,
            category,
            notes: notes ? [{ content: notes }] : []
        });

        await lead.save();
        res.status(201).json({ success: true, data: lead });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get all leads for a partner
export const getMyLeads = async (req, res) => {
    try {
        const partnerId = req.user._id;
        const leads = await Lead.find({ partnerId, isDeleted: false }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: leads });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update a lead
export const updateLead = async (req, res) => {
    try {
        const { id } = req.params;
        const partnerId = req.user._id;
        const updateData = req.body;

        // If adding a new note
        if (updateData.newNote) {
            await Lead.findOneAndUpdate(
                { _id: id, partnerId },
                { $push: { notes: { content: updateData.newNote } } }
            );
            delete updateData.newNote;
        }

        const lead = await Lead.findOneAndUpdate(
            { _id: id, partnerId },
            { $set: updateData },
            { new: true }
        );

        if (!lead) {
            return res.status(404).json({ success: false, message: "Lead not found" });
        }

        res.status(200).json({ success: true, data: lead });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete a lead (soft delete)
export const deleteLead = async (req, res) => {
    try {
        const { id } = req.params;
        const partnerId = req.user._id;

        const lead = await Lead.findOneAndUpdate(
            { _id: id, partnerId },
            { $set: { isDeleted: true } },
            { new: true }
        );

        if (!lead) {
            return res.status(404).json({ success: false, message: "Lead not found" });
        }

        res.status(200).json({ success: true, message: "Lead deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
