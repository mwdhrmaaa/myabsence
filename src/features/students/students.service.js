const { getDatabase } = require('../../core/database/connection');

function getStudentsByClass(classId) {
    const db = getDatabase();
    return db.prepare(`
        SELECT 
            id, class_id as classId, student_number as studentNumber,
            full_name as fullName, gender, parent_phone as parentPhone, status, created_at
        FROM students
        WHERE class_id = ?
        ORDER BY CAST(student_number AS INTEGER) ASC, student_number ASC
    `).all(classId);
}

function getStudentById(id) {
    const db = getDatabase();
    return db.prepare(`
        SELECT 
            id, class_id as classId, student_number as studentNumber,
            full_name as fullName, gender, parent_phone as parentPhone, status, created_at
        FROM students
        WHERE id = ?
    `).get(id);
}

function createStudent({ classId, studentNumber, fullName, gender = null, parentPhone = null }) {
    const db = getDatabase();
    const result = db.prepare(`
        INSERT INTO students (class_id, student_number, full_name, gender, parent_phone)
        VALUES (?, ?, ?, ?, ?)
    `).run(classId, studentNumber, fullName, gender, parentPhone);

    return getStudentById(result.lastInsertRowid);
}

function updateStudent(id, { studentNumber, fullName, gender, parentPhone }) {
    const db = getDatabase();
    db.prepare(`
        UPDATE students
        SET student_number = COALESCE(?, student_number),
            full_name = COALESCE(?, full_name),
            gender = COALESCE(?, gender),
            parent_phone = COALESCE(?, parent_phone)
        WHERE id = ?
    `).run(studentNumber, fullName, gender, parentPhone, id);

    return getStudentById(id);
}

function deleteStudent(id) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM students WHERE id = ?').run(id);
    return result.changes > 0;
}

function importStudentsFromCsv(classId, csvText) {
    const db = getDatabase();
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) return { imported: 0 };

    const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const numberIndex = header.findIndex(h => h.includes('number') || h.includes('no') || h.includes('id') || h.includes('absen'));
    const nameIndex = header.findIndex(h => h.includes('name') || h.includes('nama'));
    const genderIndex = header.findIndex(h => h.includes('gender') || h.includes('kelamin') || h.includes('jk'));
    const phoneIndex = header.findIndex(h => h.includes('phone') || h.includes('hp') || h.includes('telp') || h.includes('parent'));

    const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO students (class_id, student_number, full_name, gender, parent_phone)
        VALUES (?, ?, ?, ?, ?)
    `);

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
        const fullName = parts[nameIndex >= 0 ? nameIndex : 1];
        if (!fullName) continue;

        const studentNumber = parts[numberIndex >= 0 ? numberIndex : 0] || String(i).padStart(2, '0');
        const gender = genderIndex >= 0 ? parts[genderIndex] : null;
        const parentPhone = phoneIndex >= 0 ? parts[phoneIndex] : null;

        insertStmt.run(classId, studentNumber, fullName, gender, parentPhone);
        imported++;
    }

    return { imported };
}

function exportStudentsCsv(classId) {
    const students = getStudentsByClass(classId);
    const headers = ['Number', 'Full Name', 'Gender', 'Parent Phone', 'Status'];
    const rows = students.map(s => [
        `"${s.studentNumber}"`,
        `"${s.fullName}"`,
        `"${s.gender || ''}"`,
        `"${s.parentPhone || ''}"`,
        `"${s.status}"`
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

module.exports = {
    getStudentsByClass,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
    importStudentsFromCsv,
    exportStudentsCsv
};
