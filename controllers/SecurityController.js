import SecurityService from '../.../../service/SecurityService.js';
import { getClientIP } from '../utils/helper.js';

class SecurityController {
    async recordIncident(req, res) {
        try {
            const result = await SecurityService.recordIncident(
                req.user.id,
                req.body,
                req.headers['user-agent'],
                getClientIP(req)
            );
            res.json(result);
        } catch (error) {
            console.error('Error recording security incident:', error);
            res.status(500).json({ error: 'Failed to record security incident' });
        }
    }
}

export default new SecurityController();
