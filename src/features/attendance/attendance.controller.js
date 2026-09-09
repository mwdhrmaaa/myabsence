const attendanceService = require('./attendance.service');
const { sendSuccess, sendBadRequest, sendNotFound } = require('../../core/http/response');

function handleGetOrCreateSession(req, res) {
    const classId = parseInt(req.query.classId, 10);
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const subjectName = req.query.subjectName || null;
    const periodInfo = req.query.periodInfo || null;

    if (!classId) {
        return sendBadRequest(res, 'classId is required');
    }

    const session = attendanceService.getOrCreateSession(classId, date, subjectName, periodInfo);
    const sessionDetails = attendanceService.getSessionWithRecords(session.id);
    return sendSuccess(res, sessionDetails);
}

function handleUpdateSessionInfo(req, res) {
    const sessionId = parseInt(req.params.id, 10);
    const { subjectName, periodInfo, lessonNotes } = req.body;

    if (!sessionId) {
        return sendBadRequest(res, 'Valid sessionId is required');
    }

    attendanceService.updateSessionInfo(sessionId, { subjectName, periodInfo, lessonNotes });
    const sessionDetails = attendanceService.getSessionWithRecords(sessionId);
    return sendSuccess(res, sessionDetails, 'Session details updated');
}

function handleRecordSingle(req, res) {
    const { sessionId, studentId, status, note } = req.body;
    if (!sessionId || !studentId || !status) {
        return sendBadRequest(res, 'sessionId, studentId, and status are required');
    }

    const validStatuses = ['present', 'late', 'sick', 'permit', 'absent'];
    if (!validStatuses.includes(status)) {
        return sendBadRequest(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const result = attendanceService.recordAttendance(sessionId, studentId, status, note);
    return sendSuccess(res, { record: result }, 'Attendance recorded');
}

function handleGetMonthlyMatrix(req, res) {
    const classId = parseInt(req.query.classId, 10);
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || (now.getMonth() + 1);

    if (!classId) {
        return sendBadRequest(res, 'classId query parameter is required');
    }

    const matrix = attendanceService.getMonthlyMatrix(classId, year, month);
    return sendSuccess(res, matrix);
}

module.exports = {
    handleGetOrCreateSession,
    handleUpdateSessionInfo,
    handleRecordSingle,
    handleGetMonthlyMatrix
};
