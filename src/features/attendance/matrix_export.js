function generateMonthlyMatrixData(users = [], activeWorkdays = [], year = new Date().getFullYear(), month = new Date().getMonth()) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthStr = (month + 1).toString().padStart(2, '0');
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const monthName = monthNames[month] || `Bulan ${month + 1}`;

    const dateHeaders = [];
    for (let d = 1; d <= daysInMonth; d++) {
        const dStr = `${year}-${monthStr}-${d.toString().padStart(2, '0')}`;
        dateHeaders.push({ day: d, dateStr: dStr });
    }

    const rows = users.map((user, idx) => {
        const logs = user.attendanceLogs || {};
        let countH = 0;
        let countS = 0;
        let countI = 0;
        let countA = 0;

        const dayStatuses = dateHeaders.map(({ dateStr }) => {
            const rawStatus = logs[dateStr];
            if (!rawStatus) return '-';
            switch (rawStatus) {
                case 'present':
                    countH++;
                    return 'H';
                case 'sick':
                    countS++;
                    return 'S';
                case 'permit':
                    countI++;
                    return 'I';
                case 'absent':
                    countA++;
                    return 'A';
                case 'late':
                    countH++;
                    return 'T';
                default:
                    return '-';
            }
        });

        const activeDaysInThisMonth = dateHeaders.filter(h => activeWorkdays.includes(h.dateStr)).length;
        const totalEffective = activeDaysInThisMonth > 0 ? activeDaysInThisMonth : (countH + countS + countI + countA);
        const percentage = totalEffective > 0 ? ((countH / totalEffective) * 100).toFixed(1) : '0.0';

        return {
            no: idx + 1,
            absenceNumber: user.absence_number || String(idx + 1).padStart(2, '0'),
            name: user.name,
            dayStatuses,
            countH,
            countS,
            countI,
            countA,
            percentage: `${percentage}%`
        };
    });

    return {
        year,
        month,
        monthName,
        daysInMonth,
        dateHeaders,
        rows
    };
}

function convertMatrixToCsv(matrixData, metadata = {}) {
    const { year, monthName, daysInMonth, rows } = matrixData;
    const teacherName = metadata.teacherName || 'Pendidik';
    const subjectName = metadata.subjectName || 'Wali Kelas';
    const className = metadata.className || 'Kelas';

    let csv = '\uFEFF';
    csv += `LAPORAN REKAPITULASI PRESENSI BULANAN\n`;
    csv += `Bulan:;${monthName} ${year}\n`;
    csv += `Kelas / Mapel:;${className} - ${subjectName}\n`;
    csv += `Pendidik / Wali Kelas:;${teacherName}\n`;
    csv += `\n`;

    const daysHeader = Array.from({ length: daysInMonth }, (_, i) => i + 1).join(';');
    csv += `No;No Absen;Nama Siswa;${daysHeader};H;S;I;A;% Kehadiran\n`;

    rows.forEach(r => {
        const rowDays = r.dayStatuses.join(';');
        const safeName = r.name && r.name.includes(';') ? `"${r.name.replace(/"/g, '""')}"` : (r.name || '');
        csv += `${r.no};${r.absenceNumber};${safeName};${rowDays};${r.countH};${r.countS};${r.countI};${r.countA};${r.percentage}\n`;
    });

    return csv;
}

module.exports = {
    generateMonthlyMatrixData,
    convertMatrixToCsv
};
