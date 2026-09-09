const crypto = require('crypto');

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function seedDatabase(db) {
    // Check if user exists
    const userCheck = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCheck.count > 0) return;

    // 1. Seed Default Teacher
    const defaultPasswordHash = hashPassword('teacher123');
    const insertUser = db.prepare(`
        INSERT INTO users (username, email, password_hash, full_name, role)
        VALUES (?, ?, ?, ?, ?)
    `);
    const teacherResult = insertUser.run('teacher', 'teacher@school.edu', defaultPasswordHash, 'Senior Educator', 'teacher');
    const teacherId = teacherResult.lastInsertRowid;

    // 2. Seed Academic Year
    const insertYear = db.prepare(`
        INSERT INTO academic_years (name, is_active, start_date, end_date)
        VALUES (?, 1, '2026-01-01', '2026-12-31')
    `);
    const yearResult = insertYear.run('Academic Year 2026/2027');
    const yearId = yearResult.lastInsertRowid;

    // 3. Seed Default Classes
    const insertClass = db.prepare(`
        INSERT INTO classes (academic_year_id, teacher_id, name, grade_level, room)
        VALUES (?, ?, ?, ?, ?)
    `);
    const classA = insertClass.run(yearId, teacherId, 'Grade 10 - Science A', '10', 'Room 301');
    const classB = insertClass.run(yearId, teacherId, 'Grade 10 - Science B', '10', 'Room 302');

    // 4. Seed Subjects
    const insertSubject = db.prepare(`
        INSERT INTO subjects (class_id, name, code)
        VALUES (?, ?, ?)
    `);
    insertSubject.run(classA.lastInsertRowid, 'Physics', 'PHY-10');
    insertSubject.run(classA.lastInsertRowid, 'Mathematics', 'MATH-10');

    // 5. Seed Initial Students for Class A
    const insertStudent = db.prepare(`
        INSERT INTO students (class_id, student_number, full_name, gender, parent_phone)
        VALUES (?, ?, ?, ?, ?)
    `);
    const sampleStudents = [
        ['01', 'Aditya Pratama', 'M', '+6281234567801'],
        ['02', 'Budi Santoso', 'M', '+6281234567802'],
        ['03', 'Citra Dewi', 'F', '+6281234567803'],
        ['04', 'Dian Sastro', 'F', '+6281234567804'],
        ['05', 'Eko Prasetyo', 'M', '+6281234567805'],
        ['06', 'Fanya Ramadhani', 'F', '+6281234567806'],
        ['07', 'Gilang Ramadhan', 'M', '+6281234567807'],
        ['08', 'Hana Pertiwi', 'F', '+6281234567808']
    ];

    sampleStudents.forEach(([num, name, gender, phone]) => {
        insertStudent.run(classA.lastInsertRowid, num, name, gender, phone);
    });

    console.log('[Database] Seeded initial educator, academic year, classes, and roster.');
}

module.exports = {
    seedDatabase,
    hashPassword
};
