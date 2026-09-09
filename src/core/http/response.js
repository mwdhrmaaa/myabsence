function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff'
    });
    res.end(JSON.stringify(data));
}

function sendSuccess(res, data = {}, message = 'Operation successful') {
    sendJson(res, 200, { success: true, message, data });
}

function sendCreated(res, data = {}, message = 'Resource created') {
    sendJson(res, 201, { success: true, message, data });
}

function sendError(res, statusCode, message, details = null) {
    sendJson(res, statusCode, {
        success: false,
        error: {
            code: statusCode,
            message,
            ...(details ? { details } : {})
        }
    });
}

function sendBadRequest(res, message = 'Bad request') {
    sendError(res, 400, message);
}

function sendUnauthorized(res, message = 'Authentication required') {
    sendError(res, 401, message);
}

function sendForbidden(res, message = 'Access forbidden') {
    sendError(res, 403, message);
}

function sendNotFound(res, message = 'Resource not found') {
    sendError(res, 404, message);
}

module.exports = {
    sendJson,
    sendSuccess,
    sendCreated,
    sendError,
    sendBadRequest,
    sendUnauthorized,
    sendForbidden,
    sendNotFound
};
