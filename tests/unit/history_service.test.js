const test = require('node:test');
const assert = require('node:assert/strict');
const {
    formatDateIndonesian,
    getRecordedDates,
    getDateAttendanceSummary,
    getMonthlyHistory
} = require('../../src/features/attendance/history.service');

test('History Service - formatDateIndonesian formats date strings accurately', () => {
    const formatted = formatDateIndonesian('2026-09-08');
    assert.match(formatted, /Selasa, 8 September 2026/);
    assert.equal(formatDateIndonesian(null), '-');
});

test('History Service - getRecordedDates extracts all distinct dates sorted descending', () => {
    const mockUsers = [
        { id: 1, attendanceLogs: { '2026-09-01': 'present', '2026-09-05': 'sick' } },
        { id: 2, attendanceLogs: { '2026-09-05': 'present', '2026-09-08': 'present' } }
    ];
    const mockWorkdays = ['2026-09-02'];
    const dates = getRecordedDates(mockUsers, mockWorkdays);

    assert.deepEqual(dates, ['2026-09-08', '2026-09-05', '2026-09-02', '2026-09-01']);
});

test('History Service - getDateAttendanceSummary calculates daily breakdown and percentages', () => {
    const mockUsers = [
        { id: 1, attendanceLogs: { '2026-09-08': 'present' } },
        { id: 2, attendanceLogs: { '2026-09-08': 'sick' } },
        { id: 3, attendanceLogs: { '2026-09-08': 'permit' } },
        { id: 4, attendanceLogs: { '2026-09-08': 'alpha' } },
        { id: 5, attendanceLogs: {} } // unrecorded
    ];

    const summary = getDateAttendanceSummary(mockUsers, '2026-09-08');
    assert.equal(summary.totalStudents, 5);
    assert.equal(summary.present, 1);
    assert.equal(summary.sick, 1);
    assert.equal(summary.permit, 1);
    assert.equal(summary.alpha, 1);
    assert.equal(summary.unrecorded, 1);
    assert.equal(summary.recordedCount, 4);
    assert.equal(summary.attendanceRate, 20.0);
});

test('History Service - getMonthlyHistory filters dates strictly by year and month', () => {
    const mockUsers = [
        { id: 1, attendanceLogs: { '2026-09-01': 'present', '2026-08-30': 'present' } }
    ];
    const historySept = getMonthlyHistory(mockUsers, 2026, 8); // month 8 is September (0-indexed)
    assert.equal(historySept.length, 1);
    assert.equal(historySept[0].dateStr, '2026-09-01');
});
