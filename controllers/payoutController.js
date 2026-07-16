import Setting from '../models/setting.js';

/**
 * Shared helper to calculate partner balance
 */
const calculateBalance = async (partnerId) => {
    // 1. Total Earnings from paid orders
    const referralOrders = await Order.find({
        'referredByPartner.partnerId': partnerId,
        'payment.status': 'paid'
    }).select('grandTotal').lean();

    const commissionRate = await Setting.getPartnerCommissionRate();
    const rateMultiplier = commissionRate / 100;

    const totalEarned = referralOrders.reduce((sum, order) => {
        const total = parseFloat(order.grandTotal?.toString() || '0');
        return sum + (total * rateMultiplier);
    }, 0);

    // 2. Total Withdrawn (only completed payouts)
    const payouts = await PartnerPayout.find({ 
        partnerId, 
        status: 'completed' 
    }).select('amount').lean();

    const totalWithdrawn = payouts.reduce((sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 0);

    // 3. Pending Payouts (currently being processed)
    const pendingPayouts = await PartnerPayout.find({
        partnerId,
        status: 'pending'
    }).select('amount').lean();

    const totalPending = pendingPayouts.reduce((sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 0);

    return {
        totalEarned: parseFloat(totalEarned.toFixed(2)),
        totalWithdrawn: parseFloat(totalWithdrawn.toFixed(2)),
        totalPending: parseFloat(totalPending.toFixed(2)),
        withdrawableBalance: parseFloat((totalEarned - totalWithdrawn - totalPending).toFixed(2))
    };
};

export const requestPayout = async (req, res) => {
    try {
        const partnerId = req.user._id;
        const { amount, bankDetails, notes } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: "Invalid amount" });
        }

        if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifscCode) {
            return res.status(400).json({ success: false, message: "Bank details are required" });
        }


        const stats = await calculateBalance(partnerId);

        if (amount > stats.withdrawableBalance) {
            return res.status(400).json({ 
                success: false, 
                message: `Insufficient balance. Max withdrawable: ₹${stats.withdrawableBalance}` 
            });
        }

        const payout = await PartnerPayout.create({
            partnerId,
            amount,
            bankDetails,
            notes,
            status: 'pending'
        });

        return res.status(201).json({
            success: true,
            message: "Withdrawal request submitted successfully",
            data: payout
        });
    } catch (error) {
        console.error("Payout Request Error:", error);
        return res.status(500).json({ success: false, message: "Failed to submit request", err: error.message });
    }
};

export const getPartnerPayouts = async (req, res) => {
    try {
        const partnerId = req.user._id;
        const payouts = await PartnerPayout.find({ partnerId }).sort({ createdAt: -1 }).lean();
        const stats = await calculateBalance(partnerId);

        return res.status(200).json({
            success: true,
            data: {
                payouts,
                stats
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch payouts", err: error.message });
    }
};

export const getAdminPayouts = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = {};
        if (status) filter.status = status;

        const payouts = await PartnerPayout.find(filter)
            .populate('partnerId', 'fullName email phone')
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: payouts
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch payouts", err: error.message });
    }
};

export const updatePayoutStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, transactionId, adminNotes } = req.body;

        if (!['completed', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        const updateData = { status, adminNotes };
        if (status === 'completed') {
            if (!transactionId) {
                return res.status(400).json({ success: false, message: "Transaction ID is required for completion" });
            }
            updateData.transactionId = transactionId;
            updateData.paidAt = new Date();
        }

        const payout = await PartnerPayout.findByIdAndUpdate(id, updateData, { new: true });

        if (!payout) {
            return res.status(404).json({ success: false, message: "Payout record not found" });
        }

        return res.status(200).json({
            success: true,
            message: `Payout ${status} successfully`,
            data: payout
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to update payout", err: error.message });
    }
};
