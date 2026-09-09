// MyAbsence v2.0 - Client Application Engine
(function () {
    const state = {
        classes: [],
        activeClassId: null,
        sessionDate: new Date().toISOString().split('T')[0],
        currentSession: null,
        students: [],
        analytics: null,
        warnings: []
    };

    // DOM Elements
    const classSelect = document.getElementById('class-select');
    const sessionDatePicker = document.getElementById('session-date-picker');
    const rosterBody = document.getElementById('roster-table-body');
    const statRate = document.getElementById('stat-attendance-rate');
    const statStudents = document.getElementById('stat-total-students');
    const statClassName = document.getElementById('stat-active-class-name');
    const statToday = document.getElementById('stat-today-present');
    const statWarnings = document.getElementById('stat-warnings-count');
    const warningSection = document.getElementById('warning-section');
    const warningList = document.getElementById('warning-list');
    const modalStudent = document.getElementById('modal-student');
    const modalClass = document.getElementById('modal-class');
    const csvFileInput = document.getElementById('csv-file-input');

    // API Helper
    async function api(path, options = {}) {
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        const res = await fetch(path, { ...options, headers });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `HTTP ${res.status}`);
        }
        return res.json();
    }

    // Init App
    async function init() {
        sessionDatePicker.value = state.sessionDate;
        setupEventListeners();
        await loadClasses();
    }

    function setupEventListeners() {
        classSelect.addEventListener('change', (e) => {
            state.activeClassId = parseInt(e.target.value, 10);
            loadSessionAndRoster();
        });

        sessionDatePicker.addEventListener('change', (e) => {
            state.sessionDate = e.target.value;
            loadSessionAndRoster();
        });

        document.getElementById('btn-today').addEventListener('click', () => {
            state.sessionDate = new Date().toISOString().split('T')[0];
            sessionDatePicker.value = state.sessionDate;
            loadSessionAndRoster();
        });

        document.getElementById('btn-add-class').addEventListener('click', () => {
            modalClass.classList.remove('hidden');
        });

        document.getElementById('btn-add-student').addEventListener('click', () => {
            if (!state.activeClassId) return alert('Please select or create a class first');
            modalStudent.classList.remove('hidden');
        });

        document.getElementById('class-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('input-class-name').value.trim();
            const gradeLevel = document.getElementById('input-class-grade').value.trim();
            const room = document.getElementById('input-class-room').value.trim();
            try {
                const res = await api('/api/classes', {
                    method: 'POST',
                    body: JSON.stringify({ name, gradeLevel, room })
                });
                modalClass.classList.add('hidden');
                e.target.reset();
                await loadClasses(res.data.class.id);
            } catch (err) {
                alert('Error creating class: ' + err.message);
            }
        });

        document.getElementById('student-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const studentNumber = document.getElementById('input-student-number').value.trim();
            const fullName = document.getElementById('input-student-name').value.trim();
            const parentPhone = document.getElementById('input-student-phone').value.trim();
            try {
                await api(`/api/classes/${state.activeClassId}/students`, {
                    method: 'POST',
                    body: JSON.stringify({ studentNumber, fullName, parentPhone })
                });
                modalStudent.classList.add('hidden');
                e.target.reset();
                await loadSessionAndRoster();
            } catch (err) {
                alert('Error registering student: ' + err.message);
            }
        });

        document.getElementById('btn-mark-all-present').addEventListener('click', async () => {
            if (!state.currentSession || !state.students.length) return;
            for (const s of state.students) {
                if (s.status !== 'present') {
                    await setAttendanceStatus(s.id, 'present');
                }
            }
        });

        document.getElementById('btn-export-csv').addEventListener('click', () => {
            if (!state.activeClassId) return;
            window.location.href = `/api/classes/${state.activeClassId}/students/export`;
        });

        document.getElementById('btn-import-csv').addEventListener('click', () => {
            if (!state.activeClassId) return alert('Select a class first');
            csvFileInput.click();
        });

        csvFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            try {
                const res = await api(`/api/classes/${state.activeClassId}/students/import`, {
                    method: 'POST',
                    body: JSON.stringify({ csvContent: text })
                });
                alert(`Successfully imported ${res.data.imported} students!`);
                await loadSessionAndRoster();
            } catch (err) {
                alert('Import failed: ' + err.message);
            }
            csvFileInput.value = '';
        });
    }

    async function loadClasses(preferredId = null) {
        try {
            const res = await api('/api/classes');
            state.classes = res.data.classes || [];
            classSelect.innerHTML = '';

            if (state.classes.length === 0) {
                classSelect.innerHTML = '<option value="">No classes available</option>';
                rosterBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem;">No classes found. Click "New Class" to create one.</td></tr>';
                return;
            }

            state.classes.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `${c.name} (${c.studentCount} students)`;
                classSelect.appendChild(opt);
            });

            state.activeClassId = preferredId || state.classes[0].id;
            classSelect.value = state.activeClassId;

            await loadSessionAndRoster();
        } catch (err) {
            console.error('Error loading classes:', err);
        }
    }

    async function loadSessionAndRoster() {
        if (!state.activeClassId) return;
        rosterBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem;">Updating roster...</td></tr>';

        try {
            const sessionRes = await api(`/api/attendance/session?classId=${state.activeClassId}&date=${state.sessionDate}`);
            state.currentSession = sessionRes.data.session;
            state.students = sessionRes.data.students || [];

            renderRoster();
            loadAnalytics();
        } catch (err) {
            rosterBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--status-absent); padding:1.5rem;">Failed to load session: ${err.message}</td></tr>`;
        }
    }

    function renderRoster() {
        if (state.students.length === 0) {
            rosterBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No students enrolled in this class yet. Click "Add Student" or "Import CSV".</td></tr>';
            return;
        }

        rosterBody.innerHTML = '';
        state.students.forEach(student => {
            const tr = document.createElement('tr');
            const currentStatus = student.status || 'present';

            tr.innerHTML = `
                <td style="font-weight:600; color:var(--text-secondary);">${student.studentNumber}</td>
                <td style="font-weight:600;">${student.fullName}</td>
                <td style="color:var(--text-muted); font-size:0.85rem;">${student.parentPhone || '-'}</td>
                <td style="text-align:center;">
                    <div class="status-pill-group" data-student-id="${student.id}">
                        <button class="status-btn ${currentStatus === 'present' ? 'active-present' : ''}" data-status="present">P</button>
                        <button class="status-btn ${currentStatus === 'late' ? 'active-late' : ''}" data-status="late">L</button>
                        <button class="status-btn ${currentStatus === 'sick' ? 'active-sick' : ''}" data-status="sick">S</button>
                        <button class="status-btn ${currentStatus === 'permit' ? 'active-permit' : ''}" data-status="permit">I</button>
                        <button class="status-btn ${currentStatus === 'absent' ? 'active-absent' : ''}" data-status="absent">A</button>
                    </div>
                </td>
                <td>
                    <input type="text" class="form-input note-input" style="padding:4px 8px; font-size:0.8rem; width:100%; max-width:180px;" 
                           placeholder="Optional note" value="${student.note || ''}" data-student-id="${student.id}">
                </td>
                <td style="text-align:right;">
                    <button class="btn btn-secondary btn-del-student" style="padding:4px 8px; font-size:0.75rem; border-color:transparent;" data-id="${student.id}" title="Remove Student">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            `;

            // Bind pill click events
            const pillGroup = tr.querySelector('.status-pill-group');
            pillGroup.querySelectorAll('.status-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const newStatus = btn.getAttribute('data-status');
                    setAttendanceStatus(student.id, newStatus);
                });
            });

            // Note change event
            const noteInput = tr.querySelector('.note-input');
            noteInput.addEventListener('blur', () => {
                setAttendanceStatus(student.id, student.status || 'present', noteInput.value.trim());
            });

            // Delete student event
            tr.querySelector('.btn-del-student').addEventListener('click', async () => {
                if (!confirm(`Remove ${student.fullName} from class?`)) return;
                try {
                    await api(`/api/students/${student.id}`, { method: 'DELETE' });
                    await loadSessionAndRoster();
                } catch (err) {
                    alert('Error removing student: ' + err.message);
                }
            });

            rosterBody.appendChild(tr);
        });
    }

    async function setAttendanceStatus(studentId, status, note = null) {
        if (!state.currentSession) return;
        const student = state.students.find(s => s.id === studentId);
        if (student) {
            student.status = status;
            if (note !== null) student.note = note;
        }

        // Optimistic pill UI update
        const pillGroup = document.querySelector(`.status-pill-group[data-student-id="${studentId}"]`);
        if (pillGroup) {
            pillGroup.querySelectorAll('.status-btn').forEach(b => {
                b.className = 'status-btn';
                if (b.getAttribute('data-status') === status) {
                    b.classList.add(`active-${status}`);
                }
            });
        }

        try {
            await api('/api/attendance/record', {
                method: 'POST',
                body: JSON.stringify({
                    sessionId: state.currentSession.id,
                    studentId,
                    status,
                    note: note !== null ? note : (student?.note || null)
                })
            });
            updateHeaderStats();
        } catch (err) {
            console.error('Failed to save status:', err);
        }
    }

    async function loadAnalytics() {
        if (!state.activeClassId) return;
        try {
            const [analyticsRes, warningsRes] = await Promise.all([
                api(`/api/analytics/classes/${state.activeClassId}`),
                api(`/api/analytics/classes/${state.activeClassId}/warnings`)
            ]);

            state.analytics = analyticsRes.data;
            state.warnings = warningsRes.data.warnings || [];

            updateHeaderStats();
            renderWarnings();
        } catch (err) {
            console.error('Analytics load error:', err);
        }
    }

    function updateHeaderStats() {
        const activeClass = state.classes.find(c => c.id === state.activeClassId);
        if (statClassName && activeClass) statClassName.textContent = activeClass.name;
        if (statStudents) statStudents.textContent = state.students.length;

        const presentCount = state.students.filter(s => s.status === 'present' || s.status === 'late').length;
        if (statToday) statToday.textContent = `${presentCount} / ${state.students.length}`;

        if (state.analytics && statRate) {
            statRate.textContent = `${state.analytics.overallRate}%`;
        }

        if (statWarnings) {
            statWarnings.textContent = state.warnings.length;
        }
    }

    function renderWarnings() {
        if (state.warnings.length === 0) {
            warningSection.classList.add('hidden');
            return;
        }

        warningSection.classList.remove('hidden');
        warningList.innerHTML = '';
        state.warnings.forEach(w => {
            const item = document.createElement('div');
            item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.85rem; background:rgba(245, 158, 11, 0.08); border-radius:6px; font-size:0.875rem;';
            item.innerHTML = `
                <div>
                    <strong style="color:#fff;">[${w.studentNumber}] ${w.fullName}</strong>
                    <span style="color:var(--text-secondary); margin-left:0.5rem;">- ${w.message}</span>
                </div>
                <span class="brand-badge" style="background:rgba(245, 158, 11, 0.2); border-color:#f59e0b; color:#fef3c7;">Rate: ${w.attendanceRate}%</span>
            `;
            warningList.appendChild(item);
        });
    }

    window.closeStudentModal = () => modalStudent.classList.add('hidden');
    window.closeClassModal = () => modalClass.classList.add('hidden');

    document.addEventListener('DOMContentLoaded', init);
})();
