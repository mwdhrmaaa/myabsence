const test = require('node:test');
const assert = require('node:assert/strict');
const { getDatabase } = require('../../src/core/database/connection');
const { seedDatabase } = require('../../src/core/database/seed');
const classesService = require('../../src/features/classes/classes.service');
const studentsService = require('../../src/features/students/students.service');
const attendanceService = require('../../src/features/attendance/attendance.service');
const analyticsService = require('../../src/features/analytics/analytics.service');

test('Attendance Engine - Session and Multi-Status Records', () => {
    seedDatabase(getDatabase());
    const classes = classesService.getAllClasses();
    const testClass = classes[0];
    const students = studentsService.getStudentsByClass(testClass.id);
    const testStudent = students[0];

    const testDate = '2026-09-09';
    const session = attendanceService.getOrCreateSession(testClass.id, testDate);
    assert.ok(session.id, 'Session should be created or retrieved');

    // Record 'present'
    const rec1 = attendanceService.recordAttendance(session.id, testStudent.id, 'present', 'On time');
    assert.strictEqual(rec1.status, 'present');

    // Update to 'late'
    const rec2 = attendanceService.recordAttendance(session.id, testStudent.id, 'late', 'Traffic delay');
    assert.strictEqual(rec2.status, 'late');
    assert.strictEqual(rec2.note, 'Traffic delay');

    // Verify session details
    const details = attendanceService.getSessionWithRecords(session.id);
    const recorded = details.students.find(s => s.id === testStudent.id);
    assert.strictEqual(recorded.status, 'late');
    assert.strictEqual(recorded.note, 'Traffic delay');

    // Analytics verify
    const analytics = analyticsService.getClassAnalytics(testClass.id);
    assert.ok(typeof analytics.overallRate === 'number');
});
