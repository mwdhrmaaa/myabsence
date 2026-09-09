const Router = require('./router');
const auth = require('../../features/auth/auth.controller');
const classes = require('../../features/classes/classes.controller');
const students = require('../../features/students/students.controller');
const attendance = require('../../features/attendance/attendance.controller');
const analytics = require('../../features/analytics/analytics.controller');

function createApiRouter() {
    const router = new Router();

    // Authentication
    router.post('/api/auth/login', auth.handleLogin);
    router.get('/api/auth/me', auth.handleGetCurrentUser);

    // Classes
    router.get('/api/classes', classes.handleListClasses);
    router.get('/api/classes/:id', classes.handleGetClass);
    router.post('/api/classes', classes.handleCreateClass);
    router.put('/api/classes/:id', classes.handleUpdateClass);
    router.delete('/api/classes/:id', classes.handleDeleteClass);

    // Students
    router.get('/api/classes/:classId/students', students.handleListStudents);
    router.post('/api/classes/:classId/students', students.handleCreateStudent);
    router.put('/api/students/:id', students.handleUpdateStudent);
    router.delete('/api/students/:id', students.handleDeleteStudent);
    router.post('/api/classes/:classId/students/import', students.handleImportCsv);
    router.get('/api/classes/:classId/students/export', students.handleExportCsv);

    // Attendance
    router.get('/api/attendance/session', attendance.handleGetOrCreateSession);
    router.put('/api/attendance/session/:id', attendance.handleUpdateSessionInfo);
    router.post('/api/attendance/record', attendance.handleRecordSingle);
    router.get('/api/attendance/matrix', attendance.handleGetMonthlyMatrix);

    // Analytics
    router.get('/api/analytics/classes/:classId', analytics.handleClassAnalytics);
    router.get('/api/analytics/classes/:classId/warnings', analytics.handleEarlyWarnings);

    return router;
}

module.exports = {
    createApiRouter
};
