const { getDatabase } = require('../../core/database/connection');

function getClassAnalytics(classId) {
    const db = getDatabase();

    const totalStudents = db.prepare('SELECT COUNT(*) as count FROM students WHERE class_id = ?').get(classId).count;
    const totalSessions = db.prepare('SELECT COUNT(*) as count FROM attendance_sessions WHERE class_id = ?').get(classId).count;

    const breakdown = db.prepare(`
        SELECT r.status, COUNT(r.id) as count
        FROM attendance_records r
        JOIN attendance_sessions s ON r.session_id = s.id
        WHERE s.class_id = ?
        GROUP BY r.status
    `).all(classId);

    const counts = { present: 0, late: 0, sick: 0, permit: 0, absent: 0 };
    breakdown.forEach(b => {
        counts[b.status] = b.count;
    });

    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);
    const overallRate = totalRecords > 0 
        ? Math.round(((counts.present + counts.late) / totalRecords) * 100) 
        : 100;

    return {
        totalStudents,
        totalSessions,
        overallRate,
        counts
    };
}

function getEarlyWarnings(classId) {
    const db = getDatabase();
    const students = db.prepare(`
        SELECT id, student_number as studentNumber, full_name as fullName
        FROM students WHERE class_id = ?
    `).all(classId);

    const warnings = [];

    for (const student of students) {
        const stats = db.prepare(`
            SELECT 
                COUNT(r.id) as total,
                SUM(CASE WHEN r.status IN ('present', 'late') THEN 1 ELSE 0 END) as attended,
                SUM(CASE WHEN r.status = 'absent' THEN 1 ELSE 0 END) as unexcused
            FROM attendance_records r
            JOIN attendance_sessions s ON r.session_id = s.id
            WHERE s.class_id = ? AND r.student_id = ?
        `).get(classId, student.id);

        if (stats.total > 0) {
            const rate = Math.round((stats.attended / stats.total) * 100);
            if (rate < 75 || stats.unexcused >= 3) {
                warnings.push({
                    studentId: student.id,
                    studentNumber: student.studentNumber,
                    fullName: student.fullName,
                    attendanceRate: rate,
                    unexcusedAbsences: stats.unexcused,
                    riskLevel: stats.unexcused >= 5 || rate < 60 ? 'critical' : 'warning',
                    message: stats.unexcused >= 3 
                        ? `${stats.unexcused} unexcused absences recorded`
                        : `Attendance rate dropped to ${rate}%`
                });
            }
        }
    }

    return warnings;
}

module.exports = {
    getClassAnalytics,
    getEarlyWarnings
};
