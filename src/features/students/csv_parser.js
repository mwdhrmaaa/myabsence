function detectDelimiter(headerLine) {
    if (!headerLine) return ',';
    const semicolons = (headerLine.match(/;/g) || []).length;
    const commas = (headerLine.match(/,/g) || []).length;
    return semicolons > commas ? ';' : ',';
}

function parseCsvLine(csvLine, delimiter = ',') {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < csvLine.length; i++) {
        const char = csvLine[i];
        if (char === '"') {
            if (inQuotes && csvLine[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === delimiter && !inQuotes) {
            result.push(cur.trim());
            cur = '';
        } else {
            cur += char;
        }
    }
    result.push(cur.trim());
    return result;
}

function parseStudentCsv(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('CSV content is empty or invalid');
    }

    const cleanText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    const lines = cleanText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) {
        throw new Error('CSV must contain at least a header row and one data row');
    }

    const delimiter = detectDelimiter(lines[0]);
    const headerParts = parseCsvLine(lines[0], delimiter).map(h => h.toLowerCase().replace(/["']/g, '').trim());

    const isFullExport = headerParts.includes('detailed logs') || headerParts.includes('overall %') || (headerParts.length >= 8);
    const parsedStudents = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = parseCsvLine(line, delimiter);
        if (parts.length < 2) continue;

        if (isFullExport && parts.length >= 8) {
            const id = parseInt(parts[0], 10) || (i);
            const absenceNumber = parts[1].replace(/["']/g, '').trim() || String(i).padStart(2, '0');
            const name = parts[2].replace(/["']/g, '').trim() || `Student ${i}`;

            const attendanceLogs = {};
            const rawLogs = (parts[7] || '').replace(/["']/g, '').trim();
            if (rawLogs) {
                if (rawLogs.includes('|') || rawLogs.includes(':')) {
                    rawLogs.split('|').forEach(item => {
                        const [d, s] = item.split(':');
                        if (d && d.trim()) attendanceLogs[d.trim()] = (s && s.trim()) ? s.trim() : 'present';
                    });
                } else {
                    rawLogs.split(',').forEach(d => {
                        const trimmed = d.trim();
                        if (trimmed) attendanceLogs[trimmed] = 'present';
                    });
                }
            }

            parsedStudents.push({
                id,
                absence_number: absenceNumber,
                name,
                attendanceLogs,
                updatedAt: Date.now()
            });
        } else {
            let absNum = '';
            let name = '';
            if (parts.length >= 3 && !isNaN(parseInt(parts[0], 10)) && !isNaN(parseInt(parts[1], 10))) {
                absNum = parts[1].replace(/["']/g, '').trim();
                name = parts[2].replace(/["']/g, '').trim();
            } else {
                absNum = parts[0].replace(/["']/g, '').trim();
                name = parts[1].replace(/["']/g, '').trim();
            }

            if (name && name.length > 0) {
                parsedStudents.push({
                    id: i,
                    absence_number: absNum || String(i).padStart(2, '0'),
                    name,
                    attendanceLogs: {},
                    updatedAt: Date.now()
                });
            }
        }
    }

    if (parsedStudents.length === 0) {
        throw new Error('No valid student records found in CSV');
    }

    return parsedStudents;
}

module.exports = {
    detectDelimiter,
    parseCsvLine,
    parseStudentCsv
};
