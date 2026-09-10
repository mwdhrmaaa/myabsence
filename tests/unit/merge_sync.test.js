const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mergeStudentRecords, isDummyStudent, hasOnlyDummyStudents } = require('../../src/features/sync/sync.merger');

test('Sync Merger - identifies dummy vs real student lists', () => {
    const dummyList = [
        { id: 1, name: 'Student 1' },
        { id: 2, name: 'Student 2' }
    ];
    assert.equal(hasOnlyDummyStudents(dummyList), true);

    const realList = [
        { id: 1, name: 'Budi Santoso' },
        { id: 2, name: 'Siti Rahma' }
    ];
    assert.equal(hasOnlyDummyStudents(realList), false);
});

test('Sync Merger - replaces dummy list with incoming real student list', () => {
    const localDummies = [
        { id: 1, name: 'Student 1', attendanceLogs: {} }
    ];
    const incomingReal = [
        { id: 1, name: 'Ahmad Dahlan', absence_number: '01', attendanceLogs: { '2026-09-01': 'present' }, updatedAt: 1000 }
    ];

    const merged = mergeStudentRecords(localDummies, incomingReal);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].name, 'Ahmad Dahlan');
    assert.equal(merged[0].attendanceLogs['2026-09-01'], 'present');
});

test('Sync Merger - granular multi-device concurrent updates merge without data loss', () => {
    // Teacher on laptop marked Student A on 2026-09-10
    const local = [
        {
            id: 1,
            name: 'Ahmad Dahlan',
            absence_number: '01',
            attendanceLogs: { '2026-09-10': 'present' },
            updatedAt: 1000
        },
        {
            id: 2,
            name: 'Dewi Sartika',
            absence_number: '02',
            attendanceLogs: { '2026-09-09': 'present' },
            updatedAt: 500
        }
    ];

    // Teacher on mobile marked Student B on 2026-09-10 as sick
    const remote = [
        {
            id: 1,
            name: 'Ahmad Dahlan',
            absence_number: '01',
            attendanceLogs: { '2026-09-08': 'present' }, // Older entry from remote
            updatedAt: 800
        },
        {
            id: 2,
            name: 'Dewi Sartika',
            absence_number: '02',
            attendanceLogs: { '2026-09-09': 'present', '2026-09-10': 'sick' },
            updatedAt: 1500 // Newer update on mobile
        }
    ];

    const merged = mergeStudentRecords(local, remote);

    assert.equal(merged.length, 2);

    // Student 1: should have 2026-09-10 (from laptop) AND 2026-09-08 (from remote)
    const student1 = merged.find(u => u.absence_number === '01');
    assert.equal(student1.attendanceLogs['2026-09-10'], 'present');
    assert.equal(student1.attendanceLogs['2026-09-08'], 'present');

    // Student 2: should have 2026-09-09 AND 2026-09-10 as sick
    const student2 = merged.find(u => u.absence_number === '02');
    assert.equal(student2.attendanceLogs['2026-09-09'], 'present');
    assert.equal(student2.attendanceLogs['2026-09-10'], 'sick');
});

test('Sync Merger - remote new student addition merges cleanly into local list', () => {
    const local = [
        { id: 1, name: 'Ahmad Dahlan', absence_number: '01', attendanceLogs: {}, updatedAt: 100 }
    ];
    const remote = [
        { id: 1, name: 'Ahmad Dahlan', absence_number: '01', attendanceLogs: {}, updatedAt: 100 },
        { id: 2, name: 'Ki Hajar Dewantara', absence_number: '02', attendanceLogs: { '2026-09-10': 'present' }, updatedAt: 200 }
    ];

    const merged = mergeStudentRecords(local, remote);
    assert.equal(merged.length, 2);
    assert.equal(merged[1].name, 'Ki Hajar Dewantara');
    assert.equal(merged[1].absence_number, '02');
    assert.equal(merged[1].attendanceLogs['2026-09-10'], 'present');
});
