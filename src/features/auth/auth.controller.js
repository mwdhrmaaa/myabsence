const { login, verifyToken } = require('./auth.service');
const { sendSuccess, sendBadRequest, sendUnauthorized } = require('../../core/http/response');

function handleLogin(req, res) {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
        return sendBadRequest(res, 'Username/email and password are required');
    }

    const authResult = login(identifier, password);
    if (!authResult) {
        return sendUnauthorized(res, 'Invalid credentials');
    }

    return sendSuccess(res, authResult, 'Login successful');
}

function handleGetCurrentUser(req, res) {
    const user = authenticateRequest(req);
    if (!user) {
        return sendUnauthorized(res, 'Invalid or expired session');
    }
    return sendSuccess(res, { user }, 'Session verified');
}

function authenticateRequest(req) {
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7).trim();
    return verifyToken(token);
}

module.exports = {
    handleLogin,
    handleGetCurrentUser,
    authenticateRequest
};
