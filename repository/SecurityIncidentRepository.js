import SecurityIncident from '../models/SecurityIncident.js';

class SecurityIncidentRepository {
    async create(incidentData) {
        const incident = new SecurityIncident(incidentData);
        return await incident.save();
    }

    async find(query) {
        return await SecurityIncident.find(query);
    }

    async findRecentIncidents(userId, hours = 24) {
        return await SecurityIncident.find({
            userId,
            severity: 'High',
            timestamp: { $gte: new Date(Date.now() - hours * 60 * 60 * 1000) },
            resolved: false
        });
    }

    async findByDateRange(startDate, endDate, additionalQuery = {}) {
        return await SecurityIncident.find({
            timestamp: { $gte: startDate, $lte: endDate },
            ...additionalQuery
        });
    }
}

export default new SecurityIncidentRepository();