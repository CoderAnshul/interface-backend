// config/cashfree.js
// Cashfree Payment Gateway Configuration
// Reads CASHFREE_APP_ID and CASHFREE_SECRET_KEY from DB Settings (like Razorpay did)
import Setting from '../models/setting.js';

const CASHFREE_SANDBOX_URL = 'https://sandbox.cashfree.com/pg';
const CASHFREE_PROD_URL = 'https://api.cashfree.com/pg';

/**
 * Returns Cashfree base URL based on environment
 */
export const getCashfreeBaseUrl = () => {
    const env = process.env.CASHFREE_ENV || 'sandbox';
    return env === 'production' ? CASHFREE_PROD_URL : CASHFREE_SANDBOX_URL;
};

/**
 * Returns { appId, secretKey } fetched from DB Settings
 */
export const getCashfreeCredentials = async () => {
    const settings = await Setting.find({
        key: { $in: ['CASHFREE_APP_ID', 'CASHFREE_SECRET_KEY'] }
    }).select('key value');

    const config = {};
    settings.forEach(s => { config[s.key] = s.value; });

    // Fallback to environment variables if not in DB
    const appId = config.CASHFREE_APP_ID || process.env.CASHFREE_APP_ID;
    const secretKey = config.CASHFREE_SECRET_KEY || process.env.CASHFREE_SECRET_KEY;

    if (!appId || !secretKey) {
        throw new Error(
            'Cashfree credentials missing. Add CASHFREE_APP_ID and CASHFREE_SECRET_KEY ' +
            'to your .env file or the Settings table in DB.'
        );
    }

    return { appId, secretKey };
};

/**
 * Returns headers required for Cashfree API calls
 */
export const getCashfreeHeaders = async () => {
    const { appId, secretKey } = await getCashfreeCredentials();
    return {
        'x-api-version': '2023-08-01',
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'Content-Type': 'application/json',
    };
};
