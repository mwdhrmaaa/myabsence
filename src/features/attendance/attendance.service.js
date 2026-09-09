const crypto = require('crypto');
const { getDatabase } = require('../../core/database/connection');

function getOrCreateSession(classId, sessionDate, subjectName = null, periodInfo = null, lessonNotes = null) {
    const db = getDatabase();
    let session = db.prepare(`
        SELECT id, class_id as classId, subject_name as subjectName, period_info as periodInfo,
               lesson_notes as lessonNotes, session_date as sessionDate, title, qr_token as qrToken,
               is_closed as isClosed, created_at as createdAt
        FROM attendance_sessions
        WHERE class_id = ? AND session_date = ?
    `).get(classId, sessionDate);

    if (!session) {
        const qrToken = crypto.randomBytes(16).toString('hex');
        const cleanSubject = subjectName ? subjectName.trim() : 'Umum';
        const cleanPeriod = periodInfo ? periodInfo.trim() : 'Jam 1-2';

        const result = db.prepare(`
            INSERT INTO attendance_sessions (class_id, subject_name, period_info, lesson_notes, session_date, title, qr_token)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(classId, cleanSubject, cleanPeriod, lessonNotes || '', sessionDate, `Sesi ${cleanSubject} - ${sessionDate}`, qrToken);

        session = db.prepare(`
            SELECT id, class_id as classId, subject_name as subjectName, period_info as periodInfo,
                   lesson_notes as lessonNotes, session_date as sessionDate, title, qr_token as qrToken,
                   is_closed as isClosed, created_at as createdAt
            FROM attendance_sessions WHERE id = ?
        `).get(result.lastInsertRowid);
    } else if (subjectName || periodInfo || lessonNotes !== null) {
        updateSessionInfo(session.id, { subjectName, periodInfo, lessonNotes });
        session = db.prepare(`
            SELECT id, class_id as classId, subject_name as subjectName, period_info as periodInfo,
                   lesson_notes as lessonNotes, session_date as sessionDate, title, qr_token as qrToken,
                   is_closed as isClosed, created_at as createdAt
            FROM attendance_sessions WHERE id = ?
        `).get(session.id);
    }

    return session;
}

function updateSessionInfo(sessionId, { subjectName, periodInfo, lessonNotes }) {
    const db = getDatabase();
    db.prepare(`
        UPDATE attendance_sessions
        SET subject_name = COALESCE(?, subject_name),
            period_info = COALESCE(?, period_info),
            lesson_notes = COALESCE(?, lesson_notes)
        WHERE id = ?
    `).run(
        subjectName !== undefined ? subjectName : null,
        periodInfo !== undefined ? periodInfo : null,
        lessonNotes !== undefined ? lessonNotes : null,
        sessionId
    );
}

function getSessionWithRecords(sessionId) {
    const db = getDatabase();
    const session = db.prepare(`
        SELECT id, class_id as classId, subject_name as subjectName, period_info as periodInfo,
               lesson_notes as lessonNotes, session_date as sessionDate, title, qr_token as qrToken,
               is_closed as isClosed
        FROM attendance_sessions WHERE id = ?
    `).get(sessionId);

    if (!session) return null;

    const students = db.prepare(`
        SELECT s.id, s.student_number as studentNumber, s.full_name as fullName, s.parent_phone as parentPhone,
               r.status, r.note, r.recorded_at as recordedAt
        FROM students s
        LEFT JOIN attendance_records r ON r.student_id = s.id AND r.session_id = ?
        WHERE s.class_id = ?
        ORDER BY CAST(s.student_number AS INTEGER) ASC, s.student_number ASC
    `).all(sessionId, session.classId);

    // Get list of previous subject names used in this class for autocomplete
    const subjects = db.prepare(`
        SELECT DISTINCT subject_name as name FROM attendance_sessions
        WHERE class_id = ? AND subject_name IS NOT NULL AND subject_name != ''
    `).all(session.classId).map(s => s.name);

    return { session, students, subjects };
}

function recordAttendance(sessionId, studentId, status, note = null) {
    const db = getDatabase();
    const stmt = db.prepare(`
        INSERT INTO attendance_records (session_id, student_id, status, note, recorded_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(session_id, student_id) DO UPDATE SET
            status = excluded.status,
            note = excluded.note,
            updated_at = datetime('now')
    `);
    stmt.run(sessionId, studentId, status, note);
    return { sessionId, studentId, status, note };
}

function getMonthlyMatrix(classId, year, month) {
    const db = getDatabase();
    const padMonth = String(month).padStart(2, '0');
    const pattern = `${year}-${padMonth}-%`;

    const sessions = db.prepare(`
        SELECT id, session_date as date, subject_name as subjectName, period_info as periodInfo, title
        FROM attendance_sessions
        WHERE class_id = ? AND session_date LIKE ?
        ORDER BY session_date ASC
    `).all(classId, pattern);

    const students = db.prepare(`
        SELECT id, student_number as studentNumber, full_name as fullName
        FROM students WHERE class_id = ?
        ORDER BY CAST(student_number AS INTEGER) ASC, student_number ASC
    `).all(classId);

    const records = db.prepare(`
        SELECT r.student_id as studentId, s.session_date as date, r.status
        FROM attendance_records r
        JOIN attendance_sessions s ON r.session_id = s.id
        WHERE s.class_id = ? AND s.session_date LIKE ?
    `).all(classId, pattern);

    const recordMap = {};
    for (const r of records) {
        if (!recordMap[r.studentId]) recordMap[r.studentId] = {};
        recordMap[r.studentId][r.date] = r.status;
    }

    return {
        year,
        month,
        sessions,
        students: students.map(s => ({
            ...s,
            attendance: recordMap[s.id] || {}
        }))
    };
}

module.exports = {
    getOrCreateSession,
    updateSessionInfo,
    getSessionWithRecords,
    recordAttendance,
    getMonthlyMatrix
};
