const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function formatDateIndonesian(dateInput) {
    if (!dateInput) return '-';
    let d;
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        const [year, month, day] = dateInput.split('-').map(Number);
        d = new Date(year, month - 1, day);
    } else {
        d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) return '-';
    return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function getRecordedDates(users = [], activeWorkdays = []) {
    const dateSet = new Set();

    if (Array.isArray(activeWorkdays)) {
        activeWorkdays.forEach(d => {
            if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
                dateSet.add(d);
            }
        });
    }

    if (Array.isArray(users)) {
        users.forEach(u => {
            const logs = u.attendanceLogs || {};
            Object.keys(logs).forEach(dateStr => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    dateSet.add(dateStr);
                }
            });
        });
    }

    return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
}

function getDateAttendanceSummary(users = [], dateStr) {
    const totalStudents = Array.isArray(users) ? users.length : 0;
    let present = 0;
    let sick = 0;
    let permit = 0;
    let alpha = 0;
    let unrecorded = 0;

    if (totalStudents > 0) {
        users.forEach(u => {
            const logs = u.attendanceLogs || {};
            const status = logs[dateStr];
            switch (status) {
                case 'present':
                    present++;
                    break;
                case 'sick':
                    sick++;
                    break;
                case 'permit':
                    permit++;
                    break;
                case 'alpha':
                case 'absent':
                    alpha++;
                    break;
                default:
                    unrecorded++;
                    break;
            }
        });
    }

    const recordedCount = present + sick + permit + alpha;
    const attendanceRate = totalStudents > 0 ? ((present / totalStudents) * 100).toFixed(1) : '0.0';

    return {
        dateStr,
        formattedDate: formatDateIndonesian(dateStr),
        totalStudents,
        present,
        sick,
        permit,
        alpha,
        unrecorded,
        recordedCount,
        attendanceRate: parseFloat(attendanceRate)
    };
}

function getMonthlyHistory(users = [], year, month) {
    const allDates = getRecordedDates(users, []);
    const monthStr = (month + 1).toString().padStart(2, '0');
    const prefix = `${year}-${monthStr}-`;

    const monthlyDates = allDates.filter(d => d.startsWith(prefix));
    return monthlyDates.map(dateStr => getDateAttendanceSummary(users, dateStr));
}

module.exports = {
    formatDateIndonesian,
    getRecordedDates,
    getDateAttendanceSummary,
    getMonthlyHistory
};
