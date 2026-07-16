import Order from '../models/Order.js';
import PartnerPayout from '../models/PartnerPayout.js';

const COMMISSION_RATE = 0.10; // 10% commission per referred sale

/**
 * GET /partner/earnings
 * Returns real-time earnings summary for the logged-in partner:
 *   - Referral commissions from paid orders where they are the referrer
 *   - Payouts / withdrawals from PartnerPayout records
 */
export const getPartnerEarnings = async (req, res) => {
    try {
        const partnerId = req.user._id;

        // ── 1. Referral earnings (commission per referred sale) ────────────
        const referralOrders = await Order.find({
            'referredByPartner.partnerId': partnerId,
            'payment.status': 'paid'
        }).populate('userId', 'fullName email').lean();

        const referralTransactions = referralOrders.map(order => {
            const grandTotal = parseFloat(order.grandTotal?.toString() || '0');
            const commission = parseFloat((grandTotal * COMMISSION_RATE).toFixed(2));
            return {
                id: order._id,
                type: 'Referral Commission',
                description: `Sale to ${order.userId?.fullName || order.userId?.email || 'Student'}`,
                amount: commission,
                status: 'Completed',
                date: order.createdAt
            };
        });

        const referralEarnings = referralTransactions.reduce((sum, t) => sum + t.amount, 0);

        // ── 2. Payout / withdrawal records ────────────────────────────────
        const payouts = await PartnerPayout.find({ partnerId }).lean();

        const payoutTransactions = payouts.map(p => ({
            id: p._id,
            type: 'Withdrawal',
            description: p.notes || 'Payout',
            amount: -Math.abs(parseFloat(p.amount?.toString() || '0')),
            status: p.status === 'completed' ? 'Completed' : p.status === 'failed' ? 'Failed' : 'Pending',
            date: p.paidAt || p.createdAt
        }));

        const totalWithdrawn = payouts
            .filter(p => p.status === 'completed')
            .reduce((sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 0);

        // ── 3. Compute summary ────────────────────────────────────────────
        const totalEarned = referralEarnings;
        const balance = totalEarned - totalWithdrawn;

        const allTransactions = [...referralTransactions, ...payoutTransactions]
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        return res.status(200).json({
            success: true,
            message: '✅ Partner earnings fetched successfully',
            data: {
                balance: parseFloat(balance.toFixed(2)),
                totalEarned: parseFloat(totalEarned.toFixed(2)),
                totalWithdrawn: parseFloat(totalWithdrawn.toFixed(2)),
                referralEarnings: parseFloat(referralEarnings.toFixed(2)),
                taskRewards: 0,         // placeholder – add task system later
                affiliateIncome: parseFloat(referralEarnings.toFixed(2)),
                recentTransactions: allTransactions
            },
            err: {}
        });
    } catch (error) {
        console.error('❌ Error in getPartnerEarnings:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch earnings',
            data: {},
            err: error.message
        });
    }
};
