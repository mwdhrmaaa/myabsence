const analyticsService = require('./analytics.service');
const { sendSuccess, sendBadRequest } = require('../../core/http/response');

function handleClassAnalytics(req, res) {
    const classId = parseInt(req.params.classId, 10);
    if (!classId) {
        return sendBadRequest(res, 'Valid classId is required');
    }
    const analytics = analyticsService.getClassAnalytics(classId);
    return sendSuccess(res, analytics);
}

function handleEarlyWarnings(req, res) {
    const classId = parseInt(req.params.classId, 10);
    if (!classId) {
        return sendBadRequest(res, 'Valid classId is required');
    }
    const warnings = analyticsService.getEarlyWarnings(classId);
    return sendSuccess(res, { warnings });
}

module.exports = {
    handleClassAnalytics,
    handleEarlyWarnings
};
