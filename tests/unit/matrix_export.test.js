const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateMonthlyMatrixData, convertMatrixToCsv } = require('../../src/features/attendance/matrix_export');

test('Monthly Attendance Matrix - aggregates daily records and statistics accurately', () => {
    const users = [
        {
            id: 1,
            name: 'Ahmad Dahlan',
            absence_number: '01',
            attendanceLogs: {
                '2026-09-01': 'present',
                '2026-09-02': 'present',
                '2026-09-03': 'sick',
                '2026-09-04': 'permit',
                '2026-09-05': 'absent'
            }
        }
    ];

    const activeWorkdays = [
        '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'
    ];

    // September 2026 (month = 8, 0-indexed)
    const data = generateMonthlyMatrixData(users, activeWorkdays, 2026, 8);

    assert.equal(data.daysInMonth, 30); // September has 30 days
    assert.equal(data.monthName, 'September');
    assert.equal(data.rows.length, 1);

    const row = data.rows[0];
    assert.equal(row.absenceNumber, '01');
    assert.equal(row.countH, 2);
    assert.equal(row.countS, 1);
    assert.equal(row.countI, 1);
    assert.equal(row.countA, 1);
    assert.equal(row.percentage, '40.0%'); // 2 / 5 = 40%

    // Check first 5 day statuses
    assert.equal(row.dayStatuses[0], 'H');
    assert.equal(row.dayStatuses[1], 'H');
    assert.equal(row.dayStatuses[2], 'S');
    assert.equal(row.dayStatuses[3], 'I');
    assert.equal(row.dayStatuses[4], 'A');
    assert.equal(row.dayStatuses[5], '-'); // Day 6 has no log
});

test('Monthly Attendance Matrix - produces valid Excel CSV string with BOM and headers', () => {
    const users = [
        {
            id: 1,
            name: 'Dewi Sartika',
            absence_number: '02',
            attendanceLogs: { '2026-09-01': 'present' }
        }
    ];
    const data = generateMonthlyMatrixData(users, ['2026-09-01'], 2026, 8);
    const csv = convertMatrixToCsv(data, {
        teacherName: 'Guru Budi',
        subjectName: 'Matematika',
        className: 'X IPA 1'
    });

    assert.ok(csv.startsWith('\uFEFF')); // BOM check
    assert.ok(csv.includes('LAPORAN REKAPITULASI PRESENSI BULANAN'));
    assert.ok(csv.includes('Bulan:;September 2026'));
    assert.ok(csv.includes('Kelas / Mapel:;X IPA 1 - Matematika'));
    assert.ok(csv.includes('Dewi Sartika'));
    assert.ok(csv.includes('100.0%'));
});
