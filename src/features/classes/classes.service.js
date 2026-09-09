const { getDatabase } = require('../../core/database/connection');

function getAllClasses() {
    const db = getDatabase();
    return db.prepare(`
        SELECT 
            c.id, c.name, c.grade_level as gradeLevel, c.room, c.created_at,
            y.name as academicYear,
            COUNT(s.id) as studentCount
        FROM classes c
        LEFT JOIN academic_years y ON c.academic_year_id = y.id
        LEFT JOIN students s ON s.class_id = c.id
        GROUP BY c.id
        ORDER BY c.name ASC
    `).all();
}

function getClassById(classId) {
    const db = getDatabase();
    const classData = db.prepare(`
        SELECT 
            c.id, c.name, c.grade_level as gradeLevel, c.room, c.created_at,
            y.name as academicYear,
            u.full_name as teacherName
        FROM classes c
        LEFT JOIN academic_years y ON c.academic_year_id = y.id
        LEFT JOIN users u ON c.teacher_id = u.id
        WHERE c.id = ?
    `).get(classId);

    if (!classData) return null;

    const subjects = db.prepare(`
        SELECT id, name, code FROM subjects WHERE class_id = ?
    `).all(classId);

    return { ...classData, subjects };
}

function createClass({ name, gradeLevel = 'General', room = '', academicYearId = null, teacherId = null }) {
    const db = getDatabase();
    let yearId = academicYearId;
    if (!yearId) {
        const activeYear = db.prepare('SELECT id FROM academic_years WHERE is_active = 1 LIMIT 1').get();
        yearId = activeYear ? activeYear.id : 1;
    }

    const result = db.prepare(`
        INSERT INTO classes (academic_year_id, teacher_id, name, grade_level, room)
        VALUES (?, ?, ?, ?, ?)
    `).run(yearId, teacherId, name, gradeLevel, room);

    return getClassById(result.lastInsertRowid);
}

function updateClass(classId, { name, gradeLevel, room }) {
    const db = getDatabase();
    db.prepare(`
        UPDATE classes 
        SET name = COALESCE(?, name),
            grade_level = COALESCE(?, grade_level),
            room = COALESCE(?, room)
        WHERE id = ?
    `).run(name, gradeLevel, room, classId);

    return getClassById(classId);
}

function deleteClass(classId) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM classes WHERE id = ?').run(classId);
    return result.changes > 0;
}

module.exports = {
    getAllClasses,
    getClassById,
    createClass,
    updateClass,
    deleteClass
};
