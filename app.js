document.addEventListener('DOMContentLoaded', () => {
    // --- Helper Functions ---
    function toLocalISO(date) {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // --- 1. Configuration & State ---
    let startDate = localStorage.getItem('myabsence_start_date') ? parseInt(localStorage.getItem('myabsence_start_date')) : new Date('2026-01-12').getTime();
    let currentUser = JSON.parse(localStorage.getItem('myabsence_user')) || null;
    
    if (currentUser && currentUser.name === 'Super Admin') {
        currentUser.name = 'Sensei!';
        localStorage.setItem('myabsence_user', JSON.stringify(currentUser));
    }
    
    let rawUsers = [];
    try {
        rawUsers = JSON.parse(localStorage.getItem('myabsence_data')) || [
            { id: 1, name: 'John Doe', absence_number: '01', presentDays: 12 },
            { id: 2, name: 'Jane Smith', absence_number: '02', presentDays: 10 },
            { id: 3, name: 'Alice Johnson', absence_number: '03', presentDays: 8 }
        ];
    } catch (e) { rawUsers = []; }

    let users = rawUsers.map(u => {
        if (!u.absence_number) u.absence_number = u.id.toString().padStart(2, '0');
        
        // Migrate to attendanceLogs
        if (!u.attendanceLogs) {
            u.attendanceLogs = {};
            // Legacy presenceDates migration
            const legacyDates = u.presenceDates || [];
            if (legacyDates.length === 0 && u.presentDays) {
                for(let i=0; i < u.presentDays; i++) {
                    const d = new Date(startDate);
                    d.setDate(d.getDate() + i);
                    legacyDates.push(toLocalISO(d));
                }
            }
            legacyDates.forEach(dStr => u.attendanceLogs[dStr] = 'present');
        }
        
        // Sync presenceDates for compatibility with existing calculations (if any)
        u.presenceDates = Object.keys(u.attendanceLogs).filter(dStr => u.attendanceLogs[dStr] === 'present');
        
        return u;
    });

    let activeWorkdays = [];
    try {
        const storedWorkdays = localStorage.getItem('myabsence_workdays');
        activeWorkdays = storedWorkdays ? JSON.parse(storedWorkdays) : [];
        if (!Array.isArray(activeWorkdays)) activeWorkdays = [];
    } catch (e) { activeWorkdays = []; }
    
    let selectedMonth = new Date().getMonth();
    let selectedYear = new Date().getFullYear();
    let modalDates = []; // Deprecated but used in modal logic
    let modalLogs = {};  // Use this for new modal logic
    let currentViewDate = new Date();
    let isRanked = false;
    let pendingStatusDate = null;
    let historySelectedMonth = new Date().getMonth();
    let syncCode = localStorage.getItem('myabsence_sync_code') || null;
    let isDragging = false;
    let dragMode = null; // 'add' or 'remove'

    // --- 2. Selectors ---
    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const enterBtn = document.getElementById('enter-btn');
    const displayName = document.getElementById('display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const currentDaySpan = document.getElementById('current-day');
    const greeting = document.getElementById('greeting');
    const attendanceBody = document.getElementById('attendance-body');
    const adminActions = document.getElementById('admin-actions');
    const addUserBtn = document.getElementById('add-user-btn');
    const downloadCsvBtn = document.getElementById('download-csv-btn');
    const toggleRankBtn = document.getElementById('toggle-rank-btn');
    const importCsvBtn = document.getElementById('import-csv-btn');
    const csvImportInput = document.getElementById('csv-import-input');
    const userModal = document.getElementById('user-modal');
    const userForm = document.getElementById('user-form');
    const closeModalBtn = document.getElementById('close-modal');
    const modalTitle = document.getElementById('modal-title');
    const avgAttendanceSpan = document.getElementById('avg-attendance');
    const startDateInput = document.getElementById('start-date-input');
    const viewMonthSelect = document.getElementById('view-month');
    const viewYearSelect = document.getElementById('view-year');
    const historyToggle = document.getElementById('history-toggle');
    const historyGridContainer = document.getElementById('history-grid-container');
    const historyDaysGrid = document.getElementById('history-days-grid');
    const manageWorkdaysBtn = document.getElementById('manage-workdays-btn');
    const workdaysModal = document.getElementById('workdays-modal');
    const workdaysGrid = document.getElementById('workdays-grid');
    const currentMonthDisplay = document.getElementById('current-month-display');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const closeWorkdaysModalBtn = document.getElementById('close-workdays-modal');
    
    const statusModal = document.getElementById('status-modal');
    const statusModalDateDisplay = document.getElementById('status-modal-date');
    const closeStatusModalBtn = document.getElementById('close-status-modal');
    const historyMonthSelect = document.getElementById('history-month-select');
    const syncCodeInput = document.getElementById('sync-code-input');
    const enterWithCodeBtn = document.getElementById('enter-with-code-btn');
    const generateCodeBtn = document.getElementById('generate-code-btn');
    const tabDirect = document.getElementById('tab-direct');
    const tabSync = document.getElementById('tab-sync');
    const panelDirect = document.getElementById('panel-direct');
    const panelSync = document.getElementById('panel-sync');

    // Dashboard Sync UI selectors
    const navSyncBtn = document.getElementById('nav-sync-btn');
    const navSyncIcon = document.getElementById('nav-sync-icon');
    const navSyncLabel = document.getElementById('nav-sync-label');
    const headerSyncBtn = document.getElementById('header-sync-btn');
    const syncModal = document.getElementById('sync-modal');
    const syncConnectedView = document.getElementById('sync-connected-view');
    const syncDisconnectedView = document.getElementById('sync-disconnected-view');
    const activeSyncCode = document.getElementById('active-sync-code');
    const copyCodeModalBtn = document.getElementById('copy-code-modal-btn');
    const disconnectSyncBtn = document.getElementById('disconnect-sync-btn');
    const closeSyncModalBtn = document.getElementById('close-sync-modal-btn');
    const closeSyncModalBtn2 = document.getElementById('close-sync-modal-btn2');
    const modalGenerateCodeBtn = document.getElementById('modal-generate-code-btn');
    const modalSyncCodeInput = document.getElementById('modal-sync-code-input');
    const modalConnectCodeBtn = document.getElementById('modal-connect-code-btn');

    // --- 3. Global Actions ---

    window.togglePresenceToday = (userId) => {
        const user = users.find(u => u.id === userId);
        if (!user) return;
        const todayStr = toLocalISO(new Date());
        if (!activeWorkdays.includes(todayStr)) return;
        
        if (user.attendanceLogs[todayStr] === 'present') {
            delete user.attendanceLogs[todayStr];
        } else {
            user.attendanceLogs[todayStr] = 'present';
        }
        user.presenceDates = Object.keys(user.attendanceLogs).filter(dStr => user.attendanceLogs[dStr] === 'present');
        saveData();
        renderTable();
    };

    window.confirmStatus = (status) => {
        if (!pendingStatusDate) return;
        if (status === 'none') {
            delete modalLogs[pendingStatusDate];
        } else {
            modalLogs[pendingStatusDate] = status;
        }
        renderHistoryGrid();
        if (statusModal) statusModal.classList.add('hidden');
        pendingStatusDate = null;
    };

    window.editUser = (id) => {
        const user = users.find(u => u.id === id);
        if (!user) return;
        if (modalTitle) modalTitle.textContent = 'Edit User';
        const editIdInput = document.getElementById('edit-user-id');
        const fullNameInput = document.getElementById('user-fullname');
        const absNumInput = document.getElementById('user-absence-number');
        if (editIdInput) editIdInput.value = user.id;
        if (fullNameInput) fullNameInput.value = user.name;
        if (absNumInput) absNumInput.value = user.absence_number || '';
        
        modalLogs = { ...user.attendanceLogs };
        // Sync modalDates for backward compatibility of UI logic if any remains
        modalDates = Object.keys(modalLogs).filter(dStr => modalLogs[dStr] === 'present');

        historySelectedMonth = new Date().getMonth();
        initHistoryMonthSelect();

        if (historyToggle) historyToggle.classList.remove('active');
        if (historyGridContainer) historyGridContainer.classList.add('hidden');
        if (userModal) userModal.classList.remove('hidden');
    };

    window.deleteUser = (id) => {
        users = users.filter(u => u.id !== id);
        saveData();
        renderTable();
    };

    const openWorkdaysModal = () => {
        if (!workdaysModal) return;
        currentViewDate = new Date();
        renderWorkdaysGrid();
        workdaysModal.classList.remove('hidden');
    };

    const changeWorkdayMonth = (diff) => {
        currentViewDate.setMonth(currentViewDate.getMonth() + diff);
        renderWorkdaysGrid();
    };

    const closeWorkdaysModal = () => {
        if (workdaysModal) workdaysModal.classList.add('hidden');
    };

    // --- 4. Logic Functions ---

    const initPeriodSelectors = () => {
        if (!viewMonthSelect || !viewYearSelect) return;
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        viewMonthSelect.innerHTML = months.map((m, i) => `<option value="${i}" ${i === selectedMonth ? 'selected' : ''}>${m}</option>`).join('');
        const startYear = 2025;
        const endYear = new Date().getFullYear() + 2;
        let yearsHTML = '';
        for (let y = startYear; y <= endYear; y++) {
            yearsHTML += `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`;
        }
        viewYearSelect.innerHTML = yearsHTML;
    };

    const calculateCurrentDay = () => {
        const now = new Date();
        now.setHours(23, 59, 59, 999);
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const diffTime = now.getTime() - start.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays > 0 ? diffDays : 0;
    };

    const getPeriodPercentage = (attendanceLogs, type) => {
        const now = new Date();
        const todayStr = toLocalISO(now);
        const programStartStr = toLocalISO(new Date(startDate));
        
        let periodStartStr, periodEndStr;

        if (type === 'weekly') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(now);
            monday.setDate(diff);
            periodStartStr = toLocalISO(monday);
            periodEndStr = "9999-12-31"; 
        } else if (type === 'monthly') {
            periodStartStr = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-01`;
            periodEndStr = toLocalISO(new Date(selectedYear, selectedMonth + 1, 0));
        } else if (type === 'yearly') {
            periodStartStr = `${selectedYear}-01-01`;
            periodEndStr = `${selectedYear}-12-31`;
        } else {
            periodStartStr = programStartStr;
            periodEndStr = "9999-12-31";
        }

        const finalStart = (periodStartStr > programStartStr) ? periodStartStr : programStartStr;
        const finalEnd = (periodEndStr < todayStr) ? periodEndStr : todayStr;

        const workdaysInPeriod = activeWorkdays.filter(dStr => dStr >= finalStart && dStr <= finalEnd);
        
        const total = workdaysInPeriod.length;
        if (total === 0) return "0.0";

        // Only count 'present' status
        const presentCount = workdaysInPeriod.filter(dStr => attendanceLogs[dStr] === 'present').length;
        return ((presentCount / total) * 100).toFixed(1);
    };

    const saveDataLocally = () => {
        localStorage.setItem('myabsence_data', JSON.stringify(users));
        localStorage.setItem('myabsence_workdays', JSON.stringify(activeWorkdays));
    };

    const generateSyncCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 12; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        return code;
    };

    const pushSync = async () => {
        if (!syncCode) return;
        const payload = { users, workdays: activeWorkdays, startDate };
        try {
            await fetch(`/api/sync/${syncCode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) { console.warn('Sync push failed:', e); }
    };

    const pullSync = async (code) => {
        try {
            const res = await fetch(`/api/sync/${code}`);
            if (!res.ok) return false;
            const data = await res.json();
            if (data.error) return false;
            let updated = false;
            if (data.users) {
                users = data.users.map(u => {
                    if (!u.attendanceLogs) u.attendanceLogs = {};
                    u.presenceDates = Object.keys(u.attendanceLogs).filter(d => u.attendanceLogs[d] === 'present');
                    return u;
                });
                updated = true;
            }
            if (data.workdays) {
                activeWorkdays = data.workdays;
                updated = true;
            }
            if (data.startDate) {
                startDate = data.startDate;
                localStorage.setItem('myabsence_start_date', startDate);
                updated = true;
            }
            if (updated) {
                saveDataLocally();
                if (currentUser) {
                    renderTable();
                    if (currentDaySpan) currentDaySpan.textContent = calculateCurrentDay();
                    if (startDateInput) startDateInput.value = new Date(startDate).toISOString().split('T')[0];
                }
            }
            return true;
        } catch (e) { console.warn('Sync pull failed:', e); return false; }
    };

    const saveData = () => {
        saveDataLocally();
        pushSync();
    };

    const renderTable = () => {
        if (!attendanceBody) return;
        attendanceBody.innerHTML = '';
        let totalPct = 0;

        let displayUsers = [...users];
        if (isRanked) {
            displayUsers.sort((a, b) => {
                const pctA = parseFloat(getPeriodPercentage(a.attendanceLogs, 'overall'));
                const pctB = parseFloat(getPeriodPercentage(b.attendanceLogs, 'overall'));

                const priorityName = "I Made Mahendra Wira Dharma";
                const isMahendraA = (a.name.toLowerCase() === priorityName.toLowerCase() && (a.absence_number === '8' || a.absence_number === '08') && pctA === 100);
                const isMahendraB = (b.name.toLowerCase() === priorityName.toLowerCase() && (b.absence_number === '8' || b.absence_number === '08') && pctB === 100);

                if (isMahendraA) return -1;
                if (isMahendraB) return 1;

                return pctB - pctA; 
            });
        } else {
            displayUsers.sort((a, b) => {
                const numA = parseInt(a.absence_number) || 999;
                const numB = parseInt(b.absence_number) || 999;
                return numA - numB;
            });
        }

        displayUsers.forEach(user => {
            const weekly = getPeriodPercentage(user.attendanceLogs, 'weekly');
            const monthly = getPeriodPercentage(user.attendanceLogs, 'monthly');
            const yearly = getPeriodPercentage(user.attendanceLogs, 'yearly');
            const overall = getPeriodPercentage(user.attendanceLogs, 'overall');
            totalPct += parseFloat(overall);
            const todayStr = toLocalISO(new Date());
            const isPresentToday = user.attendanceLogs[todayStr] === 'present';
            const isWorkdayToday = activeWorkdays.includes(todayStr);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.absence_number || user.id}</td>
                <td>${user.name}</td>
                <td class="admin-only ${currentUser && currentUser.role === 'admin' ? '' : 'hidden'}">
                    ${isWorkdayToday ? `
                        <button class="${isPresentToday ? 'btn-checkedin' : 'btn-checkin'}" onclick="togglePresenceToday(${user.id})">
                            ${isPresentToday ? 'Checked-in' : 'Mark Present'}
                        </button>
                    ` : '<span style="font-size: 0.75rem; color: var(--text-muted)">Non-workday</span>'}
                </td>
                <td>${weekly}%</td>
                <td>${monthly}%</td>
                <td>${yearly}%</td>
                <td style="font-weight: 700; color: ${overall >= 80 ? 'var(--secondary)' : 'var(--danger)'}">${overall}%</td>
                <td class="admin-only ${currentUser && currentUser.role === 'admin' ? '' : 'hidden'}">
                    <button class="btn-sm-edit" onclick="editUser(${user.id})">Edit</button>
                    <button class="btn-sm-danger" onclick="deleteUser(${user.id})">Delete</button>
                </td>
            `;
            attendanceBody.appendChild(row);
        });
        if (avgAttendanceSpan) avgAttendanceSpan.textContent = `${users.length > 0 ? (totalPct / users.length).toFixed(1) : 0}%`;
        const adminCols = document.querySelectorAll('.admin-only');
        if (currentUser && currentUser.role === 'admin') adminCols.forEach(el => el.classList.remove('hidden'));
        else adminCols.forEach(el => el.classList.add('hidden'));
    };

    const updateUI = () => {
        if (!authSection || !dashboardSection) return;
        if (!currentUser) {
            authSection.classList.add('active');
            dashboardSection.classList.remove('active');
            // Pre-fill sync code input if saved
            if (syncCode && syncCodeInput) {
                syncCodeInput.value = syncCode;
                // Switch to sync tab
                if (tabDirect) tabDirect.classList.remove('active');
                if (tabSync) tabSync.classList.add('active');
                if (panelDirect) panelDirect.classList.add('hidden');
                if (panelSync) panelSync.classList.remove('hidden');
            }
        } else {
            authSection.classList.remove('active');
            dashboardSection.classList.add('active');
            if (greeting) greeting.textContent = "Selamat mengabsen, Sensei!";
            if (currentDaySpan) currentDaySpan.textContent = calculateCurrentDay();
            if (currentUser.role === 'admin') {
                if (adminActions) adminActions.classList.remove('hidden');
                document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
                if (startDateInput) startDateInput.value = new Date(startDate).toISOString().split('T')[0];
            } else {
                if (adminActions) adminActions.classList.add('hidden');
                document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
            }
            // Update sync button in navbar
            if (navSyncBtn) {
                if (syncCode) {
                    navSyncBtn.classList.add('connected');
                    if (navSyncIcon) navSyncIcon.textContent = '🟢 🔑';
                    if (navSyncLabel) navSyncLabel.textContent = syncCode;
                } else {
                    navSyncBtn.classList.remove('connected');
                    if (navSyncIcon) navSyncIcon.textContent = '🔗';
                    if (navSyncLabel) navSyncLabel.textContent = 'Bagi / Sync Kode';
                }
            }
            renderTable();
        }
    };

    const openSyncModal = () => {
        if (!syncModal) return;
        if (syncCode) {
            if (syncConnectedView) syncConnectedView.classList.remove('hidden');
            if (syncDisconnectedView) syncDisconnectedView.classList.add('hidden');
            if (activeSyncCode) activeSyncCode.textContent = syncCode;
        } else {
            if (syncConnectedView) syncConnectedView.classList.add('hidden');
            if (syncDisconnectedView) syncDisconnectedView.classList.remove('hidden');
            if (modalSyncCodeInput) modalSyncCodeInput.value = '';
        }
        syncModal.classList.remove('hidden');
    };

    const closeSyncModal = () => {
        if (syncModal) syncModal.classList.add('hidden');
    };

    const initHistoryMonthSelect = () => {
        if (!historyMonthSelect) return;
        const currentRealMonth = new Date().getMonth();
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        historyMonthSelect.innerHTML = months.map((m, i) => {
            const label = i === currentRealMonth ? `${m} (Bulan Ini)` : m;
            return `<option value="${i}" ${i === historySelectedMonth ? 'selected' : ''}>${label}</option>`;
        }).join('');
    };

    const renderHistoryGrid = () => {
        if (!historyDaysGrid) return;
        historyDaysGrid.innerHTML = '';
        const now = new Date();
        const todayStr = toLocalISO(now);
        const year = now.getFullYear();
        const month = historySelectedMonth;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const dateStr = toLocalISO(date);
            const status = modalLogs[dateStr] || 'none';
            const isWorkday = activeWorkdays.includes(dateStr);
            const isFuture = dateStr > todayStr;
            
            const btn = document.createElement('button');
            btn.type = 'button';
            
            // Only show colors if it is an active workday
            let statusClass = '';
            if (isWorkday) {
                if (status === 'present') statusClass = 'active';
                else if (status === 'sick') statusClass = 'sick';
                else if (status === 'permit') statusClass = 'permit';
                else if (status === 'alpha') statusClass = 'alpha';
            }

            btn.className = `day-btn ${statusClass} ${isFuture ? 'future' : (!isWorkday ? 'disabled' : '')}`;
            btn.textContent = i;
            
            if (isWorkday && !isFuture) {
                btn.onclick = () => {
                    pendingStatusDate = dateStr;
                    if (statusModalDateDisplay) statusModalDateDisplay.textContent = `Status: ${date.toLocaleDateString()}`;
                    if (statusModal) statusModal.classList.remove('hidden');
                };
            }
            historyDaysGrid.appendChild(btn);
        }
    };

    const applyWorkdayDrag = (dateStr) => {
        const btn = workdaysGrid ? workdaysGrid.querySelector(`[data-date="${dateStr}"]`) : null;
        if (dragMode === 'add') {
            if (!activeWorkdays.includes(dateStr)) {
                activeWorkdays.push(dateStr);
                if (btn) btn.classList.add('active', 'dragging');
            }
        } else {
            activeWorkdays = activeWorkdays.filter(d => d !== dateStr);
            if (btn) { btn.classList.remove('active'); btn.classList.add('dragging'); }
        }
    };

    const renderWorkdaysGrid = () => {
        if (!workdaysGrid || !currentMonthDisplay) return;
        workdaysGrid.innerHTML = '';
        const todayStr = toLocalISO(new Date());
        const year = currentViewDate.getFullYear(), month = currentViewDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        currentMonthDisplay.textContent = currentViewDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const dateStr = toLocalISO(date);
            const isActive = activeWorkdays.includes(dateStr);
            const isFuture = dateStr > todayStr;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.date = dateStr;
            btn.className = `day-btn ${isActive ? 'active' : ''} ${isFuture ? 'future' : ''}`;
            btn.textContent = i;

            // Drag-to-select for any day in the month
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                isDragging = true;
                dragMode = activeWorkdays.includes(dateStr) ? 'remove' : 'add';
                applyWorkdayDrag(dateStr);
            });
            btn.addEventListener('mouseenter', () => {
                if (isDragging) applyWorkdayDrag(dateStr);
            });
            btn.addEventListener('touchstart', (e) => {
                isDragging = true;
                dragMode = activeWorkdays.includes(dateStr) ? 'remove' : 'add';
                applyWorkdayDrag(dateStr);
            }, { passive: true });

            workdaysGrid.appendChild(btn);
        }
    };

    // --- 5. Drag Global Listeners ---
    const handleWorkdayDragEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        dragMode = null;
        if (workdaysGrid) workdaysGrid.querySelectorAll('.day-btn.dragging').forEach(b => b.classList.remove('dragging'));
        saveData();
        renderTable();
    };
    document.addEventListener('mouseup', handleWorkdayDragEnd);
    document.addEventListener('touchend', handleWorkdayDragEnd);
    document.addEventListener('touchmove', (e) => {
        if (!isDragging || !workdaysGrid) return;
        const touch = e.touches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        if (el && el.dataset && el.dataset.date) {
            applyWorkdayDrag(el.dataset.date);
        }
    }, { passive: true });

    // --- 6. Event Handlers ---
    if (enterBtn) enterBtn.addEventListener('click', () => {
        syncCode = null;
        localStorage.removeItem('myabsence_sync_code');
        currentUser = { name: 'Sensei!', role: 'admin' };
        localStorage.setItem('myabsence_user', JSON.stringify(currentUser));
        updateUI();
    });

    // Sync tabs switching
    if (tabDirect) tabDirect.addEventListener('click', () => {
        tabDirect.classList.add('active');
        if (tabSync) tabSync.classList.remove('active');
        if (panelDirect) panelDirect.classList.remove('hidden');
        if (panelSync) panelSync.classList.add('hidden');
    });
    if (tabSync) tabSync.addEventListener('click', () => {
        tabSync.classList.add('active');
        if (tabDirect) tabDirect.classList.remove('active');
        if (panelSync) panelSync.classList.remove('hidden');
        if (panelDirect) panelDirect.classList.add('hidden');
    });

    // Masuk dengan kode
    if (enterWithCodeBtn) enterWithCodeBtn.addEventListener('click', async () => {
        const raw = syncCodeInput ? syncCodeInput.value.trim().toUpperCase() : '';
        if (!/^[A-Z0-9]{12}$/.test(raw)) {
            alert('Kode harus tepat 12 karakter (huruf A-Z dan angka 0-9).');
            return;
        }
        enterWithCodeBtn.textContent = 'Memuat data...';
        enterWithCodeBtn.disabled = true;
        const found = await pullSync(raw);
        enterWithCodeBtn.textContent = '🔑 Masuk dengan Kode';
        enterWithCodeBtn.disabled = false;
        if (!found) {
            if (!confirm(`Kode "${raw}" belum ada di server.\n\nMau buat sesi baru dengan kode ini?`)) return;
        }
        syncCode = raw;
        localStorage.setItem('myabsence_sync_code', syncCode);
        currentUser = { name: 'Sensei!', role: 'admin' };
        localStorage.setItem('myabsence_user', JSON.stringify(currentUser));
        pushSync();
        updateUI();
    });

    // Generate kode baru
    if (generateCodeBtn) generateCodeBtn.addEventListener('click', () => {
        const code = generateSyncCode();
        if (syncCodeInput) syncCodeInput.value = code;
        if (confirm(`Kode baru berhasil dibuat:\n\n${code}\n\nCatat kode ini! Klik OK untuk masuk.`)) {
            syncCode = code;
            localStorage.setItem('myabsence_sync_code', syncCode);
            currentUser = { name: 'Sensei!', role: 'admin' };
            localStorage.setItem('myabsence_user', JSON.stringify(currentUser));
            pushSync();
            updateUI();
        }
    });

    // --- Sync Modal Event Handlers ---
    if (navSyncBtn) navSyncBtn.addEventListener('click', openSyncModal);
    if (headerSyncBtn) headerSyncBtn.addEventListener('click', openSyncModal);
    if (closeSyncModalBtn) closeSyncModalBtn.addEventListener('click', closeSyncModal);
    if (closeSyncModalBtn2) closeSyncModalBtn2.addEventListener('click', closeSyncModal);

    // Salin kode di dalam modal
    if (copyCodeModalBtn) copyCodeModalBtn.addEventListener('click', () => {
        if (!syncCode) return;
        navigator.clipboard.writeText(syncCode).then(() => {
            copyCodeModalBtn.textContent = '✅ Kode Tersalin!';
            setTimeout(() => { copyCodeModalBtn.textContent = '📋 Salin Kode'; }, 2000);
        }).catch(() => {
            prompt('Salin kode ini:', syncCode);
        });
    });

    // Buat kode baru dari dalam dashboard
    if (modalGenerateCodeBtn) modalGenerateCodeBtn.addEventListener('click', () => {
        const code = generateSyncCode();
        syncCode = code;
        localStorage.setItem('myabsence_sync_code', syncCode);
        pushSync();
        updateUI();
        openSyncModal();
    });

    // Hubungkan dengan kode dari dalam dashboard
    if (modalConnectCodeBtn) modalConnectCodeBtn.addEventListener('click', async () => {
        const raw = modalSyncCodeInput ? modalSyncCodeInput.value.trim().toUpperCase() : '';
        if (!/^[A-Z0-9]{12}$/.test(raw)) {
            alert('Kode harus tepat 12 karakter (huruf A-Z dan angka 0-9).');
            return;
        }
        modalConnectCodeBtn.textContent = 'Menghubungkan...';
        modalConnectCodeBtn.disabled = true;
        const found = await pullSync(raw);
        modalConnectCodeBtn.textContent = '🔑 Hubungkan dengan Kode';
        modalConnectCodeBtn.disabled = false;
        if (!found) {
            if (!confirm(`Kode "${raw}" belum ada di server.\n\nMau buat sesi baru dengan kode ini?`)) return;
        }
        syncCode = raw;
        localStorage.setItem('myabsence_sync_code', syncCode);
        pushSync();
        updateUI();
        openSyncModal();
    });

    // Putuskan sinkronisasi
    if (disconnectSyncBtn) disconnectSyncBtn.addEventListener('click', () => {
        if (confirm('Yakin ingin memutuskan sinkronisasi?\nData di perangkat ini tetap aman, tapi tidak akan tersinkron lagi sampai dihubungkan kembali.')) {
            syncCode = null;
            localStorage.removeItem('myabsence_sync_code');
            updateUI();
            openSyncModal();
        }
    });

    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        currentUser = null;
        localStorage.removeItem('myabsence_user');
        updateUI();
    });
    if (viewMonthSelect) viewMonthSelect.addEventListener('change', (e) => { selectedMonth = parseInt(e.target.value); renderTable(); });
    if (viewYearSelect) viewYearSelect.addEventListener('change', (e) => { selectedYear = parseInt(e.target.value); renderTable(); });
    if (historyToggle) historyToggle.addEventListener('click', () => {
        historyToggle.classList.toggle('active');
        if (historyGridContainer) {
            historyGridContainer.classList.toggle('hidden');
            if (!historyGridContainer.classList.contains('hidden')) renderHistoryGrid();
        }
    });
    if (manageWorkdaysBtn) manageWorkdaysBtn.addEventListener('click', openWorkdaysModal);
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => changeWorkdayMonth(-1));
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => changeWorkdayMonth(1));
    if (closeWorkdaysModalBtn) closeWorkdaysModalBtn.addEventListener('click', closeWorkdaysModal);
    if (addUserBtn) addUserBtn.addEventListener('click', () => {
        if (modalTitle) modalTitle.textContent = 'Add New User';
        const editIdInput = document.getElementById('edit-user-id');
        if (editIdInput) editIdInput.value = '';
        if (userForm) userForm.reset();
        modalDates = [];
        modalLogs = {};
        historySelectedMonth = new Date().getMonth();
        initHistoryMonthSelect();
        if (historyToggle) historyToggle.classList.remove('active');
        if (historyGridContainer) historyGridContainer.classList.add('hidden');
        if (userModal) userModal.classList.remove('hidden');
    });

    if (historyMonthSelect) {
        historyMonthSelect.addEventListener('change', (e) => {
            historySelectedMonth = parseInt(e.target.value);
            renderHistoryGrid();
        });
    }
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => { if (userModal) userModal.classList.add('hidden'); });
    if (userForm) userForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-user-id').value;
        const name = document.getElementById('user-fullname').value;
        const absence_number = document.getElementById('user-absence-number').value;
        if (id) {
            const idx = users.findIndex(u => u.id == id);
            if (idx !== -1) users[idx] = { ...users[idx], name, absence_number, attendanceLogs: modalLogs };
        } else {
            const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
            users.push({ id: newId, name, absence_number, attendanceLogs: modalLogs });
        }
        // Sync presenceDates for legacy compatibility
        users.forEach(u => u.presenceDates = Object.keys(u.attendanceLogs || {}).filter(dStr => u.attendanceLogs[dStr] === 'present'));
        
        saveData();
        renderTable();
        if (userModal) userModal.classList.add('hidden');
    });

    if (closeStatusModalBtn) closeStatusModalBtn.addEventListener('click', () => { 
        if (statusModal) statusModal.classList.add('hidden'); 
    });
    if (startDateInput) startDateInput.addEventListener('change', (e) => {
        const val = new Date(e.target.value).getTime();
        if (val) { startDate = val; localStorage.setItem('myabsence_start_date', startDate); if (currentDaySpan) currentDaySpan.textContent = calculateCurrentDay(); renderTable(); }
    });

    if (toggleRankBtn) {
        toggleRankBtn.addEventListener('click', () => {
            isRanked = !isRanked;
            toggleRankBtn.classList.toggle('active');
            renderTable();
        });
    }

    if (downloadCsvBtn) {
        downloadCsvBtn.addEventListener('click', () => {
            if (users.length === 0) return;
            
            // CSV Header
            let csvContent = "ID,Absence Number,Name,Weekly %,Monthly %,Yearly %,Overall %,Detailed Logs\n";
            
            // Sort data for CSV Export (Legend Priority Rule)
            let exportUsers = [...users];
            exportUsers.sort((a, b) => {
                const pctA = parseFloat(getPeriodPercentage(a.attendanceLogs, 'overall'));
                const pctB = parseFloat(getPeriodPercentage(b.attendanceLogs, 'overall'));
                const priorityName = "I Made Mahendra Wira Dharma";
                
                const isMahendraA = (a.name.toLowerCase() === priorityName.toLowerCase() && (a.absence_number === '8' || a.absence_number === '08') && pctA === 100);
                const isMahendraB = (b.name.toLowerCase() === priorityName.toLowerCase() && (b.absence_number === '8' || b.absence_number === '08') && pctB === 100);

                if (isMahendraA) return -1;
                if (isMahendraB) return 1;

                // Default sort by Absence Number
                return (parseInt(a.absence_number) || 999) - (parseInt(b.absence_number) || 999);
            });

            // CSV Rows
            exportUsers.forEach(user => {
                const weekly = getPeriodPercentage(user.attendanceLogs, 'weekly');
                const monthly = getPeriodPercentage(user.attendanceLogs, 'monthly');
                const yearly = getPeriodPercentage(user.attendanceLogs, 'yearly');
                const overall = getPeriodPercentage(user.attendanceLogs, 'overall');
                
                // Format logs as: "2026-01-01:present|2026-01-02:sick"
                const logsStr = `"${Object.entries(user.attendanceLogs).map(([d, s]) => `${d}:${s}`).join("|")}"`;
                
                csvContent += `${user.id},${user.absence_number || user.id},${user.name},${weekly},${monthly},${yearly},${overall},${logsStr}\n`;
            });
            
            // Create Download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `MyAbsence_Data_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    if (importCsvBtn && csvImportInput) {
        importCsvBtn.addEventListener('click', () => {
            // Reset input value to allow re-selecting the same file
            csvImportInput.value = '';
            csvImportInput.click();
        });
        
        csvImportInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target.result;
                if (!text) {
                    alert("Empty file content.");
                    return;
                }

                const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
                if (lines.length < 2) {
                    alert("Not enough data in file (found " + lines.length + " lines).");
                    return;
                }
                
                const newUsers = [];
                const parseCsvLine = (csvLine) => {
                    const result = [];
                    let cur = "";
                    let inQuotes = false;
                    for (let char of csvLine) {
                        if (char === '"') inQuotes = !inQuotes;
                        else if (char === ',' && !inQuotes) {
                            result.push(cur.trim());
                            cur = "";
                        } else cur += char;
                    }
                    result.push(cur.trim());
                    return result;
                };

                try {
                    for (let i = 1; i < lines.length; i++) {
                        const parts = parseCsvLine(lines[i]);
                        if (parts.length >= 8) {
                            const id = parseInt(parts[0]) || (Date.now() + i);
                            const absNum = parts[1] || '00';
                            const name = parts[2].replace(/"/g, '') || "Unkown";
                            
                            let logsRaw = (parts[7] || "").replace(/"/g, '');
                            const attendanceLogs = {};
                            if (logsRaw) {
                                if (logsRaw.includes('|') || logsRaw.includes(':')) {
                                    logsRaw.split('|').forEach(entry => {
                                        const entryParts = entry.split(':');
                                        if (entryParts[0]) attendanceLogs[entryParts[0]] = entryParts[1] || 'present';
                                    });
                                } else {
                                    logsRaw.split(',').forEach(d => {
                                        const trimmed = d.trim();
                                        if (trimmed) attendanceLogs[trimmed] = 'present';
                                    });
                                }
                            }
                            newUsers.push({ id, name, absence_number: absNum, attendanceLogs });
                        }
                    }

                    if (newUsers.length > 0) {
                        if (confirm("Found " + newUsers.length + " users. Restore current data with this file?")) {
                            // Update core data
                            users = newUsers.map(u => ({
                                ...u,
                                presenceDates: Object.keys(u.attendanceLogs).filter(d => u.attendanceLogs[d] === 'present')
                            }));
                            saveData();
                            renderTable();
                            alert("Restore Successful! 🚀");
                        }
                    } else {
                        alert("No valid user records found in this CSV.");
                    }
                } catch (err) {
                    alert("Error processing CSV: " + err.message);
                }
            };
            reader.onerror = () => alert("FileReader Error: " + reader.error);
            reader.readAsText(file);
        });
    }

    initPeriodSelectors();
    updateUI();

    // Auto-sync on startup if logged in with sync code
    if (currentUser && syncCode) {
        pullSync(syncCode);
    }

    // Periodic auto-sync every 10 seconds for real-time multi-device sync
    setInterval(() => {
        if (currentUser && syncCode) {
            pullSync(syncCode);
        }
    }, 10000);

    // Sync on tab focus or visibility return
    window.addEventListener('focus', () => {
        if (currentUser && syncCode) pullSync(syncCode);
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && currentUser && syncCode) pullSync(syncCode);
    });

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('Service Worker registered!'))
                .catch(err => console.log('Service Worker registration failed:', err));
        });
    }
});
