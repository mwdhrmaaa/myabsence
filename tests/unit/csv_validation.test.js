const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseStudentCsv, parseCsvLine, detectDelimiter } = require('../../src/features/students/csv_parser');

test('CSV Parser - handles semicolon and comma delimiters properly', () => {
    assert.equal(detectDelimiter('ID;Name;Absence Number'), ';');
    assert.equal(detectDelimiter('ID,Name,Absence Number'), ',');
});

test('CSV Parser - parses quoted strings containing delimiters and escaped quotes', () => {
    const line = '1,"Dharma, Mahendra ""Senior""",08';
    const parsed = parseCsvLine(line, ',');
    assert.equal(parsed.length, 3);
    assert.equal(parsed[0], '1');
    assert.equal(parsed[1], 'Dharma, Mahendra "Senior"');
    assert.equal(parsed[2], '08');
});

test('CSV Parser - parses full export CSV format with attendance logs', () => {
    const csvData = [
        'ID,Absence Number,Name,Weekly %,Monthly %,Yearly %,Overall %,Detailed Logs',
        '1,01,Ahmad Dahlan,100%,100%,100%,100%,"2026-09-01:present|2026-09-02:sick"'
    ].join('\n');

    const students = parseStudentCsv(csvData);
    assert.equal(students.length, 1);
    assert.equal(students[0].name, 'Ahmad Dahlan');
    assert.equal(students[0].absence_number, '01');
    assert.equal(students[0].attendanceLogs['2026-09-01'], 'present');
    assert.equal(students[0].attendanceLogs['2026-09-02'], 'sick');
});

test('CSV Parser - parses simple teacher roster format with semicolon separator', () => {
    const csvData = [
        'No;Nama Siswa',
        '01;Budi Santoso',
        '02;Siti Aminah'
    ].join('\n');

    const students = parseStudentCsv(csvData);
    assert.equal(students.length, 2);
    assert.equal(students[0].absence_number, '01');
    assert.equal(students[0].name, 'Budi Santoso');
    assert.equal(students[1].absence_number, '02');
    assert.equal(students[1].name, 'Siti Aminah');
});

test('CSV Parser - throws descriptive error on empty or corrupt CSV', () => {
    assert.throws(() => parseStudentCsv(''), /CSV content is empty/);
    assert.throws(() => parseStudentCsv('Header Only\n'), /at least a header row and one data row/);
});
