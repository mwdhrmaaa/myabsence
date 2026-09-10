const syncService = require('./sync.service');
const { sendSuccess, sendBadRequest, sendNotFound, sendJson } = require('../../core/http/response');

function handlePushSync(req, res) {
    const code = req.params.code;
    if (!code) {
        return sendBadRequest(res, 'Sync code is required in URL parameters');
    }

    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
        return sendBadRequest(res, 'Invalid sync payload body');
    }

    try {
        const result = syncService.saveSession(code, payload);
        return sendSuccess(res, result, 'Sync data saved successfully');
    } catch (err) {
        return sendBadRequest(res, err.message);
    }
}

function handlePullSync(req, res) {
    const code = req.params.code;
    if (!code) {
        return sendBadRequest(res, 'Sync code is required in URL parameters');
    }

    const session = syncService.getSession(code);
    if (!session) {
        return sendNotFound(res, 'Sync session not found');
    }

    // Return payload object directly for seamless consumption by app client
    const payload = typeof session.data === 'object' ? session.data : { raw: session.data };
    if (!payload.updatedAt) {
        payload.updatedAt = session.updatedAt;
    }
    return sendJson(res, 200, payload);
}

function handleGetNetworkInfo(req, res) {
    const code = req.query.code || null;
    const info = syncService.getNetworkShareInfo(code);
    return sendSuccess(res, info, 'Network share info retrieved');
}

function handlePruneSync(req, res) {
    try {
        const days = req.query && req.query.days ? parseFloat(req.query.days) : 7;
        const maxAgeMs = days * 24 * 60 * 60 * 1000;
        const deletedCount = syncService.pruneSessions(maxAgeMs);
        return sendSuccess(res, { deletedCount, days }, `Successfully pruned ${deletedCount} expired sync sessions`);
    } catch (err) {
        return sendBadRequest(res, err.message);
    }
}

module.exports = {
    handlePushSync,
    handlePullSync,
    handleGetNetworkInfo,
    handlePruneSync
};
