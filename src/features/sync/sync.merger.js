// Pure Domain Function for Multi-Device Student Record Reconciliation

function isDummyStudent(u) {
    if (!u || !u.name) return false;
    const n = u.name.trim().toLowerCase();
    return ['student 1', 'student 2', 'student 3', 'john doe', 'jane smith', 'alice johnson'].includes(n);
}

function hasOnlyDummyStudents(list) {
    return Array.isArray(list) && list.length > 0 && list.every(isDummyStudent);
}

function sanitizeStudentName(name) {
    if (!name || typeof name !== 'string') return name;
    const lower = name.trim().toLowerCase();
    if (lower === 'john doe') return 'Student 1';
    if (lower === 'jane smith') return 'Student 2';
    if (lower === 'alice johnson') return 'Student 3';
    return name.trim();
}

function mergeStudentRecords(currentList = [], incomingList = []) {
    if (!Array.isArray(incomingList) || incomingList.length === 0) return currentList || [];
    if (!Array.isArray(currentList) || currentList.length === 0) {
        return incomingList.map(u => ({
            ...u,
            name: sanitizeStudentName(u.name),
            attendanceLogs: { ...(u.attendanceLogs || {}) },
            presenceDates: Object.keys(u.attendanceLogs || {}).filter(d => u.attendanceLogs[d] === 'present'),
            updatedAt: Number(u.updatedAt) || Date.now()
        }));
    }

    const currentHasReal = !hasOnlyDummyStudents(currentList);
    const incomingHasReal = !hasOnlyDummyStudents(incomingList);

    if (!currentHasReal && incomingHasReal) {
        return incomingList.map(u => ({
            ...u,
            name: sanitizeStudentName(u.name),
            attendanceLogs: { ...(u.attendanceLogs || {}) },
            presenceDates: Object.keys(u.attendanceLogs || {}).filter(d => u.attendanceLogs[d] === 'present'),
            updatedAt: Number(u.updatedAt) || Date.now()
        }));
    }

    const result = currentList.map(u => ({
        ...u,
        attendanceLogs: { ...(u.attendanceLogs || {}) },
        presenceDates: Object.keys(u.attendanceLogs || {}).filter(d => u.attendanceLogs[d] === 'present'),
        updatedAt: Number(u.updatedAt) || 0
    }));

    const studentMap = new Map();

    result.forEach((u, idx) => {
        if (u.absence_number) {
            studentMap.set(`num_${u.absence_number.toString().trim().toLowerCase()}`, idx);
        }
        studentMap.set(`id_${u.id}`, idx);
        if (u.name) {
            studentMap.set(`name_${u.name.trim().toLowerCase()}`, idx);
        }
    });

    incomingList.forEach(incUser => {
        const numKey = incUser.absence_number ? `num_${incUser.absence_number.toString().trim().toLowerCase()}` : null;
        const idKey = `id_${incUser.id}`;
        const nameKey = incUser.name ? `name_${incUser.name.trim().toLowerCase()}` : null;

        let targetIdx = -1;
        if (numKey && studentMap.has(numKey)) {
            targetIdx = studentMap.get(numKey);
        } else if (studentMap.has(idKey)) {
            targetIdx = studentMap.get(idKey);
        } else if (nameKey && studentMap.has(nameKey)) {
            targetIdx = studentMap.get(nameKey);
        }

        const incLogs = incUser.attendanceLogs || {};
        const incUpdated = Number(incUser.updatedAt) || 0;

        if (targetIdx !== -1) {
            const target = result[targetIdx];
            const targetUpdated = Number(target.updatedAt) || 0;
            const mergedLogs = { ...(target.attendanceLogs || {}) };

            for (const [dateStr, status] of Object.entries(incLogs)) {
                if (!mergedLogs[dateStr] || incUpdated >= targetUpdated) {
                    mergedLogs[dateStr] = status;
                }
            }

            result[targetIdx] = {
                ...target,
                name: (incUpdated > targetUpdated && incUser.name) ? sanitizeStudentName(incUser.name) : sanitizeStudentName(target.name),
                absence_number: (incUpdated > targetUpdated && incUser.absence_number) ? incUser.absence_number : target.absence_number,
                attendanceLogs: mergedLogs,
                presenceDates: Object.keys(mergedLogs).filter(d => mergedLogs[d] === 'present'),
                updatedAt: Math.max(targetUpdated, incUpdated)
            };
        } else if (!isDummyStudent(incUser)) {
            const cleanUser = {
                ...incUser,
                name: sanitizeStudentName(incUser.name),
                absence_number: incUser.absence_number || String(result.length + 1).padStart(2, '0'),
                attendanceLogs: { ...incLogs },
                presenceDates: Object.keys(incLogs).filter(d => incLogs[d] === 'present'),
                updatedAt: incUpdated || Date.now()
            };
            result.push(cleanUser);
            const newIdx = result.length - 1;
            if (cleanUser.absence_number) {
                studentMap.set(`num_${cleanUser.absence_number.toString().trim().toLowerCase()}`, newIdx);
            }
            studentMap.set(`id_${cleanUser.id}`, newIdx);
            if (cleanUser.name) {
                studentMap.set(`name_${cleanUser.name.trim().toLowerCase()}`, newIdx);
            }
        }
    });

    return result;
}

module.exports = {
    isDummyStudent,
    hasOnlyDummyStudents,
    sanitizeStudentName,
    mergeStudentRecords
};
