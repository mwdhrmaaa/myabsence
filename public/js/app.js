// MyAbsence v2.0 - Ruang Pengajar Humanized Engine
(function () {
    const state = {
        classes: [],
        activeClassId: null,
        sessionDate: new Date().toISOString().split('T')[0],
        subjectName: '',
        periodInfo: '',
        lessonNotes: '',
        currentSession: null,
        students: []
    };

    // DOM Elements
    const classSelect = document.getElementById('class-select');
    const subjectInput = document.getElementById('subject-input');
    const subjectDatalist = document.getElementById('subject-datalist');
    const periodInput = document.getElementById('period-input');
    const sessionDatePicker = document.getElementById('session-date-picker');
    const lessonNotesInput = document.getElementById('lesson-notes-input');
    const journalStatus = document.getElementById('journal-save-status');
    const rosterBody = document.getElementById('roster-table-body');
    const printClassInfo = document.getElementById('print-class-info');
    const printDateSignature = document.getElementById('print-date-signature');

    // Counters
    const counterTotal = document.getElementById('counter-total');
    const counterPresent = document.getElementById('counter-present');
    const counterLate = document.getElementById('counter-late');
    const counterSick = document.getElementById('counter-sick');
    const counterPermit = document.getElementById('counter-permit');
    const counterAbsent = document.getElementById('counter-absent');

    // Modals
    const modalStudent = document.getElementById('modal-student');
    const modalClass = document.getElementById('modal-class');
    const csvFileInput = document.getElementById('csv-file-input');

    async function api(path, options = {}) {
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        const res = await fetch(path, { ...options, headers });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `HTTP ${res.status}`);
        }
        return res.json();
    }

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

        // Subject change & blur
        subjectInput.addEventListener('blur', async () => {
            state.subjectName = subjectInput.value.trim();
            saveSessionMeta();
        });

        // Period info change & blur
        periodInput.addEventListener('blur', async () => {
            state.periodInfo = periodInput.value.trim();
            saveSessionMeta();
        });

        // Lesson Notes autosave
        lessonNotesInput.addEventListener('input', () => {
            if (journalStatus) journalStatus.textContent = 'Mengetik...';
        });

        lessonNotesInput.addEventListener('blur', async () => {
            state.lessonNotes = lessonNotesInput.value.trim();
            await saveSessionMeta();
            if (journalStatus) journalStatus.textContent = 'Tersimpan';
        });

        // Print Sheet
        document.getElementById('btn-print-sheet').addEventListener('click', () => {
            const activeClass = state.classes.find(c => c.id === state.activeClassId);
            const className = activeClass ? activeClass.name : '-';
            const subject = state.subjectName || 'Semua Mata Pelajaran';
            const dateStr = formatDateIndo(state.sessionDate);

            if (printClassInfo) {
                printClassInfo.textContent = `Kelas: ${className} | Mata Pelajaran: ${subject} | Jam: ${state.periodInfo || '-'} | Tanggal: ${dateStr}`;
            }
            if (printDateSignature) {
                printDateSignature.textContent = `Tanggal: ${dateStr}`;
            }
            window.print();
        });

        document.getElementById('btn-add-class').addEventListener('click', () => {
            modalClass.classList.remove('hidden');
        });

        document.getElementById('btn-add-student').addEventListener('click', () => {
            if (!state.activeClassId) return alert('Silakan pilih atau buat kelas terlebih dahulu.');
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
                alert('Gagal membuat kelas: ' + err.message);
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
                alert('Gagal mendaftarkan siswa: ' + err.message);
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
            if (!state.activeClassId) return alert('Pilih kelas terlebih dahulu');
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
                alert(`Berhasil mengimpor ${res.data.imported} siswa!`);
                await loadSessionAndRoster();
            } catch (err) {
                alert('Gagal impor CSV: ' + err.message);
            }
            csvFileInput.value = '';
        });
    }

    async function saveSessionMeta() {
        if (!state.currentSession) return;
        try {
            await api(`/api/attendance/session/${state.currentSession.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    subjectName: state.subjectName,
                    periodInfo: state.periodInfo,
                    lessonNotes: state.lessonNotes
                })
            });
        } catch (err) {
            console.error('Failed to save session metadata:', err);
        }
    }

    async function loadClasses(preferredId = null) {
        try {
            const res = await api('/api/classes');
            state.classes = res.data.classes || [];
            classSelect.innerHTML = '';

            if (state.classes.length === 0) {
                classSelect.innerHTML = '<option value="">Belum ada kelas</option>';
                rosterBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem;">Belum ada kelas. Klik "Kelas Baru" untuk membuat.</td></tr>';
                return;
            }

            state.classes.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `${c.name} (${c.studentCount} siswa)`;
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
        rosterBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem;">Memperbarui daftar kehadiran...</td></tr>';

        try {
            const sessionRes = await api(`/api/attendance/session?classId=${state.activeClassId}&date=${state.sessionDate}`);
            state.currentSession = sessionRes.data.session;
            state.students = sessionRes.data.students || [];

            // Populate subject & session metadata
            if (state.currentSession) {
                state.subjectName = state.currentSession.subjectName || '';
                state.periodInfo = state.currentSession.periodInfo || '';
                state.lessonNotes = state.currentSession.lessonNotes || '';

                subjectInput.value = state.subjectName;
                periodInput.value = state.periodInfo;
                lessonNotesInput.value = state.lessonNotes;
            }

            // Populate datalist with previous subjects from this class
            if (sessionRes.data.subjects && Array.isArray(sessionRes.data.subjects)) {
                subjectDatalist.innerHTML = '';
                const baseOptions = ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'Fisika', 'Kimia', 'Biologi', 'Informatika', 'Sejarah', 'Pendidikan Jasmani'];
                const merged = Array.from(new Set([...sessionRes.data.subjects, ...baseOptions]));
                merged.forEach(sub => {
                    const opt = document.createElement('option');
                    opt.value = sub;
                    subjectDatalist.appendChild(opt);
                });
            }

            renderRoster();
            updateCounters();
        } catch (err) {
            rosterBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--status-absent-text); padding:1.5rem;">Gagal memuat data sesi: ${err.message}</td></tr>`;
        }
    }

    function renderRoster() {
        if (state.students.length === 0) {
            rosterBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Belum ada siswa di kelas ini. Klik "Tambah Siswa" atau "Impor CSV".</td></tr>';
            return;
        }

        rosterBody.innerHTML = '';
        state.students.forEach(student => {
            const tr = document.createElement('tr');
            const currentStatus = student.status || 'present';

            // WhatsApp link helper
            let waHtml = '<span style="color:var(--text-light);">-</span>';
            if (student.parentPhone) {
                const cleanPhone = formatWaNumber(student.parentPhone);
                const waMessage = encodeURIComponent(
                    `Halo Bapak/Ibu, menginformasikan bahwa presensi ananda *${student.fullName}* pada tanggal ${formatDateIndo(state.sessionDate)} (Mapel: ${state.subjectName || 'Umum'}) tercatat: *${statusLabel(currentStatus)}*. Terima kasih.`
                );
                waHtml = `
                    <a href="https://wa.me/${cleanPhone}?text=${waMessage}" target="_blank" class="wa-link" title="Kirim Pesan WhatsApp">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
                        <span>${student.parentPhone}</span>
                    </a>
                `;
            }

            tr.innerHTML = `
                <td style="font-weight:700; text-align:center; color:var(--text-muted);">${student.studentNumber}</td>
                <td style="font-weight:600;">${student.fullName}</td>
                <td style="text-align:center;">
                    <div class="status-pill-wrap" data-student-id="${student.id}">
                        <button class="status-choice btn-present ${currentStatus === 'present' ? 'active' : ''}" data-status="present">Hadir</button>
                        <button class="status-choice btn-late ${currentStatus === 'late' ? 'active' : ''}" data-status="late">Telat</button>
                        <button class="status-choice btn-sick ${currentStatus === 'sick' ? 'active' : ''}" data-status="sick">Sakit</button>
                        <button class="status-choice btn-permit ${currentStatus === 'permit' ? 'active' : ''}" data-status="permit">Izin</button>
                        <button class="status-choice btn-absent ${currentStatus === 'absent' ? 'active' : ''}" data-status="absent">Alpa</button>
                    </div>
                </td>
                <td>
                    <input type="text" class="form-input note-input" style="padding:4px 8px; font-size:0.85rem; width:100%; max-width:180px;" 
                           placeholder="Catatan..." value="${student.note || ''}" data-student-id="${student.id}">
                </td>
                <td>${waHtml}</td>
                <td style="text-align:right;" class="btn-row-action">
                    <button class="btn btn-secondary btn-del-student" style="padding:3px 8px; font-size:0.75rem; border-color:transparent; color:#94a3b8;" data-id="${student.id}" title="Hapus Siswa">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            `;

            // Status click handlers
            const pillWrap = tr.querySelector('.status-pill-wrap');
            pillWrap.querySelectorAll('.status-choice').forEach(btn => {
                btn.addEventListener('click', () => {
                    const newStatus = btn.getAttribute('data-status');
                    setAttendanceStatus(student.id, newStatus);
                });
            });

            // Note handler
            const noteInput = tr.querySelector('.note-input');
            noteInput.addEventListener('blur', () => {
                setAttendanceStatus(student.id, student.status || 'present', noteInput.value.trim());
            });

            // Delete handler
            tr.querySelector('.btn-del-student').addEventListener('click', async () => {
                if (!confirm(`Hapus siswa ${student.fullName} dari kelas?`)) return;
                try {
                    await api(`/api/students/${student.id}`, { method: 'DELETE' });
                    await loadSessionAndRoster();
                } catch (err) {
                    alert('Gagal menghapus siswa: ' + err.message);
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

        // Optimistic UI updates
        const pillWrap = document.querySelector(`.status-pill-wrap[data-student-id="${studentId}"]`);
        if (pillWrap) {
            pillWrap.querySelectorAll('.status-choice').forEach(b => {
                b.classList.remove('active');
                if (b.getAttribute('data-status') === status) {
                    b.classList.add('active');
                }
            });
        }

        updateCounters();

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
        } catch (err) {
            console.error('Gagal menyimpan status:', err);
        }
    }

    function updateCounters() {
        const total = state.students.length;
        let present = 0, late = 0, sick = 0, permit = 0, absent = 0;

        state.students.forEach(s => {
            const st = s.status || 'present';
            if (st === 'present') present++;
            else if (st === 'late') late++;
            else if (st === 'sick') sick++;
            else if (st === 'permit') permit++;
            else if (st === 'absent') absent++;
        });

        if (counterTotal) counterTotal.textContent = total;
        if (counterPresent) counterPresent.textContent = present;
        if (counterLate) counterLate.textContent = late;
        if (counterSick) counterSick.textContent = sick;
        if (counterPermit) counterPermit.textContent = permit;
        if (counterAbsent) counterAbsent.textContent = absent;
    }

    function formatWaNumber(phone) {
        let clean = phone.replace(/[^0-9]/g, '');
        if (clean.startsWith('0')) clean = '62' + clean.slice(1);
        return clean;
    }

    function formatDateIndo(dateString) {
        if (!dateString) return '-';
        const [year, month, day] = dateString.split('-');
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
    }

    function statusLabel(status) {
        const labels = {
            present: 'HADIR',
            late: 'TERLAMBAT',
            sick: 'SAKIT',
            permit: 'IZIN',
            absent: 'ALPA'
        };
        return labels[status] || 'HADIR';
    }

    window.closeStudentModal = () => modalStudent.classList.add('hidden');
    window.closeClassModal = () => modalClass.classList.add('hidden');

    document.addEventListener('DOMContentLoaded', init);
})();
