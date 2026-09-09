const test = require('node:test');
const assert = require('node:assert/strict');
const { getDatabase } = require('../../src/core/database/connection');
const { seedDatabase } = require('../../src/core/database/seed');
const classesService = require('../../src/features/classes/classes.service');
const studentsService = require('../../src/features/students/students.service');

test('Classes and Students - Domain Lifecycle', () => {
    seedDatabase(getDatabase());
    const classes = classesService.getAllClasses();
    assert.ok(Array.isArray(classes), 'Classes should be an array');
    assert.ok(classes.length >= 1, 'Initial seeded classes should exist');

    const firstClass = classes[0];
    const students = studentsService.getStudentsByClass(firstClass.id);
    assert.ok(Array.isArray(students));
    assert.ok(students.length >= 1, 'Seeded students should be present');

    // Create a new test student
    const newStudent = studentsService.createStudent({
        classId: firstClass.id,
        studentNumber: '99',
        fullName: 'Test Student Automated',
        parentPhone: '+1234567890'
    });

    assert.ok(newStudent.id);
    assert.strictEqual(newStudent.studentNumber, '99');
    assert.strictEqual(newStudent.fullName, 'Test Student Automated');

    // Clean up created student
    const deleted = studentsService.deleteStudent(newStudent.id);
    assert.strictEqual(deleted, true);
});
