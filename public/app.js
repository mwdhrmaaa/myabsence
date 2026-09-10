document.addEventListener('DOMContentLoaded', () => {
    // --- Helper Functions ---
    function toLocalISO(date) {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function formatIndonesianDate(date) {
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    }

    // --- 1. Configuration & State ---
    let startDate = localStorage.getItem('myabsence_start_date') ? parseInt(localStorage.getItem('myabsence_start_date')) : new Date('2026-01-12').getTime();
    let currentUser = JSON.parse(localStorage.getItem('myabsence_user')) || { name: 'Pendidik', role: 'admin' };
    
    if (currentUser && currentUser.name === 'Super Admin') {
        currentUser.name = 'Pendidik';
        localStorage.setItem('myabsence_user', JSON.stringify(currentUser));
    }
    
    const DEFAULT_STUDENTS = [
        { id: 1, name: 'Student 1', absence_number: '01', presentDays: 12 },
        { id: 2, name: 'Student 2', absence_number: '02', presentDays: 10 },
        { id: 3, name: 'Student 3', absence_number: '03', presentDays: 8 }
    ];

    const sanitizeStudentName = (name) => {
        if (!name || typeof name !== 'string') return name;
        const lower = name.trim().toLowerCase();
        if (lower === 'john doe') return 'Student 1';
        if (lower === 'jane smith') return 'Student 2';
        if (lower === 'alice johnson') return 'Student 3';
        return name;
    };

    const isDummyStudent = (u) => {
        if (!u || !u.name) return false;
        const n = u.name.trim().toLowerCase();
        return ['student 1', 'student 2', 'student 3', 'john doe', 'jane smith', 'alice johnson'].includes(n);
    };

    const hasOnlyDummyStudents = (list) => {
        return Array.isArray(list) && list.length > 0 && list.every(isDummyStudent);
    };

    let rawUsers = [];
    try {
        const stored = localStorage.getItem('myabsence_data');
        if (stored) {
            rawUsers = JSON.parse(stored);
        }
    } catch (e) { rawUsers = []; }

    if (!Array.isArray(rawUsers) || rawUsers.length === 0) {
        rawUsers = JSON.parse(JSON.stringify(DEFAULT_STUDENTS));
    }

    let users = rawUsers.map(u => {
        if (!u.absence_number) u.absence_number = (u.id || 1).toString().padStart(2, '0');
        
        // Auto convert legacy dummy names (John Doe, etc.) to Student 1, 2, 3
        u.name = sanitizeStudentName(u.name);
        
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

    // Save immediately so localStorage is guaranteed up-to-date with Student 1, 2, 3
    localStorage.setItem('myabsence_data', JSON.stringify(users));

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
    let lastSyncUpdatedAt = 0;
    let isDragging = false;
    let dragMode = null; // 'add' or 'remove'

    // Detect Share Link query param (?sync=... or ?share=... or ?connect=...)
    let incomingShareCode = null;
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const rawParam = urlParams.get('sync') || urlParams.get('share') || urlParams.get('connect');
        if (rawParam && /^[A-Z0-9]{12}$/i.test(rawParam.trim())) {
            incomingShareCode = rawParam.trim().toUpperCase();
            syncCode = incomingShareCode;
            localStorage.setItem('myabsence_sync_code', syncCode);
            // Auto authenticate incoming visitor into the synchronized session
            currentUser = { name: 'Pendidik', role: 'admin' };
            localStorage.setItem('myabsence_user', JSON.stringify(currentUser));
        }
    } catch (e) {}

    // --- 2. Selectors ---
    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const displayName = document.getElementById('display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const currentDaySpan = document.getElementById('current-day');
    const greeting = document.getElementById('greeting');
    const attendanceBody = document.getElementById('attendance-body');
    const adminActions = document.getElementById('admin-actions');
    const addUserBtn = document.getElementById('add-user-btn');
    const downloadCsvBtn = document.getElementById('download-csv-btn');
    const exportMatrixBtn = document.getElementById('export-matrix-btn');
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
    const enterAppBtn = document.getElementById('enter-app-btn');


    // Dashboard Sync UI selectors
    const navShareBtn = document.getElementById('nav-share-btn') || document.getElementById('nav-sync-btn');
    const navShareLabel = document.getElementById('nav-share-label') || document.getElementById('nav-sync-label');
    const syncModal = document.getElementById('sync-modal');
    const syncConnectedView = document.getElementById('sync-connected-view');
    const syncDisconnectedView = document.getElementById('sync-disconnected-view');
    const disconnectSyncBtn = document.getElementById('disconnect-sync-btn');
    const closeSyncModalBtn = document.getElementById('close-sync-modal-btn');
    const closeSyncModalBtn2 = document.getElementById('close-sync-modal-btn2');
    const modalGenerateCodeBtn = document.getElementById('modal-generate-code-btn');
    const modalSyncCodeInput = document.getElementById('modal-sync-code-input');
    const modalConnectCodeBtn = document.getElementById('modal-connect-code-btn');
    const shareLinkInput = document.getElementById('share-link-input');
    const copyShareLinkBtn = document.getElementById('copy-share-link-btn');
    const copyShareLinkText = document.getElementById('copy-share-link-label');
    const shareLinkTypeBadge = document.getElementById('share-link-type-badge');
    const toastContainer = document.getElementById('toast-container');

    // Custom Confirmation Modal selectors
    const confirmModal = document.getElementById('confirm-modal');
    const confirmModalTitle = document.getElementById('confirm-modal-title');
    const confirmModalMsg = document.getElementById('confirm-modal-msg');
    const confirmModalIcon = document.getElementById('confirm-modal-icon');
    const confirmModalCancelBtn = document.getElementById('confirm-modal-cancel-btn');
    const confirmModalOkBtn = document.getElementById('confirm-modal-ok-btn');
    let onConfirmAction = null;

    // --- Theme Mode State & Selectors ---
    const THEME_STORAGE_KEY = 'myabsence_theme_mode';
    const themeModal = document.getElementById('theme-modal');
    const navThemeBtn = document.getElementById('nav-theme-btn');
    const welcomeThemeToggleBtn = document.getElementById('welcome-theme-toggle-btn');
    const themeNavLabel = document.getElementById('theme-nav-label');
    const welcomeThemeLabel = document.getElementById('welcome-theme-label');
    const closeThemeModalBtn = document.getElementById('close-theme-modal-btn');
    const closeThemeModalBtn2 = document.getElementById('close-theme-modal-btn2');
    const themeCardWhite = document.getElementById('theme-card-white');
    const themeCardGrey = document.getElementById('theme-card-grey');
    const badgeWhite = document.getElementById('badge-white');
    const badgeGrey = document.getElementById('badge-grey');

    function getActiveTheme() {
        return localStorage.getItem(THEME_STORAGE_KEY) || 'white';
    }

    function applyTheme(themeName) {
        if (themeName !== 'calm-grey') {
            themeName = 'white';
        }
        document.documentElement.setAttribute('data-theme', themeName);
        localStorage.setItem(THEME_STORAGE_KEY, themeName);
        updateThemeUI(themeName);
    }

    function updateThemeUI(themeName) {
        const isCalm = themeName === 'calm-grey';
        const labelText = isCalm ? 'Stealth Slate' : 'Manga Cel';
        
        if (themeNavLabel) themeNavLabel.textContent = labelText;
        if (welcomeThemeLabel) welcomeThemeLabel.textContent = labelText;

        if (themeCardWhite && themeCardGrey) {
            if (isCalm) {
                themeCardWhite.classList.remove('active');
                themeCardGrey.classList.add('active');
                if (badgeWhite) badgeWhite.textContent = 'Pilih';
                if (badgeGrey) badgeGrey.textContent = 'Aktif';
            } else {
                themeCardWhite.classList.add('active');
                themeCardGrey.classList.remove('active');
                if (badgeWhite) badgeWhite.textContent = 'Aktif';
                if (badgeGrey) badgeGrey.textContent = 'Pilih';
            }
        }
    }

    function openThemeModal() {
        if (!themeModal) return;
        updateThemeUI(getActiveTheme());
        themeModal.classList.remove('hidden');
    }

    function closeThemeModal() {
        if (themeModal) themeModal.classList.add('hidden');
    }

    if (navThemeBtn) {
        navThemeBtn.addEventListener('click', openThemeModal);
    }
    if (welcomeThemeToggleBtn) {
        welcomeThemeToggleBtn.addEventListener('click', openThemeModal);
    }
    if (closeThemeModalBtn) {
        closeThemeModalBtn.addEventListener('click', closeThemeModal);
    }
    if (closeThemeModalBtn2) {
        closeThemeModalBtn2.addEventListener('click', closeThemeModal);
    }
    if (themeModal) {
        themeModal.addEventListener('click', (e) => {
            if (e.target === themeModal) closeThemeModal();
        });
    }
    if (themeCardWhite) {
        themeCardWhite.addEventListener('click', () => {
            applyTheme('white');
            closeThemeModal();
        });
    }
    if (themeCardGrey) {
        themeCardGrey.addEventListener('click', () => {
            applyTheme('calm-grey');
            closeThemeModal();
        });
    }

    // Initialize theme immediately on script boot
    applyTheme(getActiveTheme());

    // --- 3. Global Actions ---

    window.setStudentStatusToday = (userId, status) => {
        const user = users.find(u => u.id === userId);
        if (!user) return;
        const todayStr = toLocalISO(new Date());
        if (!activeWorkdays.includes(todayStr)) {
            activeWorkdays.push(todayStr);
            localStorage.setItem('myabsence_workdays', JSON.stringify(activeWorkdays));
        }
        
        if (user.attendanceLogs[todayStr] === status) {
            delete user.attendanceLogs[todayStr];
        } else {
            user.attendanceLogs[todayStr] = status;
        }
        user.presenceDates = Object.keys(user.attendanceLogs).filter(dStr => user.attendanceLogs[dStr] === 'present');
        user.updatedAt = Date.now();
        saveData();
        renderTable();
    };

    window.togglePresenceToday = (userId) => {
        window.setStudentStatusToday(userId, 'present');
    };

    window.markAllPresentToday = () => {
        const todayStr = toLocalISO(new Date());
        if (!activeWorkdays.includes(todayStr)) {
            activeWorkdays.push(todayStr);
            localStorage.setItem('myabsence_workdays', JSON.stringify(activeWorkdays));
        }
        const now = Date.now();
        users.forEach(user => {
            user.attendanceLogs[todayStr] = 'present';
            user.presenceDates = Object.keys(user.attendanceLogs).filter(dStr => user.attendanceLogs[dStr] === 'present');
            user.updatedAt = now;
        });
        saveData();
        renderTable();
    };

    window.resetAllToday = () => {
        showCustomConfirm({
            title: 'Reset Absensi Hari Ini?',
            message: 'Status kehadiran seluruh siswa untuk tanggal hari ini akan dikosongkan kembali.',
            icon: 'warning',
            okText: 'Ya, Kosongkan',
            onOk: () => {
                const todayStr = toLocalISO(new Date());
                const now = Date.now();
                users.forEach(user => {
                    delete user.attendanceLogs[todayStr];
                    user.presenceDates = Object.keys(user.attendanceLogs).filter(dStr => user.attendanceLogs[dStr] === 'present');
                    user.updatedAt = now;
                });
                saveData();
                renderTable();
            }
        });
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

    // --- Cloud Sync & Storage Engine ---
    let firestoreDb = null;
    let realtimeUnsub = null;

    const initCloudSync = () => {
        if (typeof firebase !== 'undefined' && window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId) {
            try {
                if (!firebase.apps.length) {
                    firebase.initializeApp(window.FIREBASE_CONFIG);
                }
                firestoreDb = firebase.firestore();
                console.log('[MyAbsence] Firebase Cloud Sync Aktif (Multi-Network Real-Time)');
                return true;
            } catch (e) {
                console.warn('[MyAbsence] Gagal inisialisasi Firebase:', e);
                firestoreDb = null;
                return false;
            }
        }
        return false;
    };

    initCloudSync();

    const subscribeRealtimeSync = (code) => {
        if (realtimeUnsub) {
            try { realtimeUnsub(); } catch(e){}
            realtimeUnsub = null;
        }
        if (!code || !firestoreDb) return;
        try {
            realtimeUnsub = firestoreDb.collection('myabsence_sync').doc(code).onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    applySyncData(data);
                }
            }, (err) => {
                console.warn('Firestore realtime error:', err);
            });
        } catch (e) {
            console.warn('Failed to subscribe realtime sync:', e);
        }
    };

    const mergeStudentRecords = (currentList, incomingList) => {
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
            if (numKey && studentMap.has(numKey)) targetIdx = studentMap.get(numKey);
            else if (studentMap.has(idKey)) targetIdx = studentMap.get(idKey);
            else if (nameKey && studentMap.has(nameKey)) targetIdx = studentMap.get(nameKey);

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
    };

    const applySyncData = (data) => {
        if (!data) return false;
        let updated = false;
        if (data.users && Array.isArray(data.users)) {
            const currentHasReal = users && users.length > 0 && !hasOnlyDummyStudents(users);
            const incomingHasOnlyDummy = hasOnlyDummyStudents(data.users);
            if (!currentHasReal || !incomingHasOnlyDummy) {
                users = mergeStudentRecords(users, data.users);
                updated = true;
            }
        }
        if (data.workdays && Array.isArray(data.workdays)) {
            const combined = Array.from(new Set([...(activeWorkdays || []), ...data.workdays])).sort();
            if (combined.length !== (activeWorkdays || []).length) {
                activeWorkdays = combined;
                updated = true;
            }
        }
        if (data.startDate) {
            startDate = data.startDate;
            localStorage.setItem('myabsence_start_date', startDate);
            updated = true;
        }
        if (data.updatedAt) {
            lastSyncUpdatedAt = Number(data.updatedAt);
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
        const now = Date.now();
        lastSyncUpdatedAt = now;
        const payload = { users, workdays: activeWorkdays, startDate, updatedAt: now };

        // 1. Cloud Firestore (Bisa sinkron di mana saja, beda Wi-Fi / paket data)
        if (firestoreDb) {
            try {
                await firestoreDb.collection('myabsence_sync').doc(syncCode).set(payload, { merge: true });
                subscribeRealtimeSync(syncCode);
                return;
            } catch (e) {
                console.warn('[Firebase Cloud Push Error]', e);
            }
        }

        // 2. Fallback ke API Server lokal / custom backend
        try {
            await fetch(`/api/sync/${syncCode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) { console.warn('Local Sync push failed:', e); }
    };

    const pullSync = async (code) => {
        if (!code) return false;

        // 1. Coba dari Cloud Firestore
        if (firestoreDb) {
            try {
                const doc = await firestoreDb.collection('myabsence_sync').doc(code).get();
                if (doc.exists) {
                    const data = doc.data();
                    applySyncData(data);
                    subscribeRealtimeSync(code);
                    return true;
                }
            } catch (e) {
                console.warn('[Firebase Cloud Pull Error]', e);
            }
        }

        // 2. Fallback ke API Server lokal
        try {
            const res = await fetch(`/api/sync/${code}`);
            if (!res.ok) return false;
            const data = await res.json();
            if (data.error) return false;
            if (data.updatedAt && Number(data.updatedAt) <= lastSyncUpdatedAt) {
                return true;
            }
            applySyncData(data);
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

        // Real-time live search filter
        const studentSearchInput = document.getElementById('student-search-input');
        const query = studentSearchInput ? studentSearchInput.value.trim().toLowerCase() : '';
        if (query) {
            displayUsers = displayUsers.filter(u => {
                const name = (u.name || '').toLowerCase();
                const absNum = (u.absence_number || '').toString().toLowerCase();
                return name.includes(query) || absNum.includes(query);
            });
        }

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

        let countPresentToday = 0;
        let countExcusedToday = 0;
        let countAlphaToday = 0;
        const todayStr = toLocalISO(new Date());

        if (displayUsers.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `
                <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem;">
                    ${query ? `Tidak ada siswa dengan kata kunci "${query}".` : 'Belum ada data siswa. Klik "+ Add New User" untuk menambahkan.'}
                </td>
            `;
            attendanceBody.appendChild(emptyRow);
        } else {
            displayUsers.forEach(user => {
                const weekly = getPeriodPercentage(user.attendanceLogs, 'weekly');
                const monthly = getPeriodPercentage(user.attendanceLogs, 'monthly');
                const yearly = getPeriodPercentage(user.attendanceLogs, 'yearly');
                const overall = getPeriodPercentage(user.attendanceLogs, 'overall');
                totalPct += parseFloat(overall);

                const todayStatus = user.attendanceLogs[todayStr];
                if (todayStatus === 'present') countPresentToday++;
                else if (todayStatus === 'sick' || todayStatus === 'permit') countExcusedToday++;
                else if (todayStatus === 'alpha') countAlphaToday++;

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="col-num">${user.absence_number || user.id}</td>
                    <td class="col-name">${sanitizeStudentName(user.name)}</td>
                    <td class="admin-only ${currentUser && currentUser.role === 'admin' ? '' : 'hidden'}" style="text-align: center;">
                        <div class="status-btn-group">
                            <button type="button" class="status-btn btn-h ${todayStatus === 'present' ? 'active' : ''}" onclick="setStudentStatusToday(${user.id}, 'present')" title="Hadir (H)">H</button>
                            <button type="button" class="status-btn btn-s ${todayStatus === 'sick' ? 'active' : ''}" onclick="setStudentStatusToday(${user.id}, 'sick')" title="Sakit (S)">S</button>
                            <button type="button" class="status-btn btn-i ${todayStatus === 'permit' ? 'active' : ''}" onclick="setStudentStatusToday(${user.id}, 'permit')" title="Izin (I)">I</button>
                            <button type="button" class="status-btn btn-a ${todayStatus === 'alpha' ? 'active' : ''}" onclick="setStudentStatusToday(${user.id}, 'alpha')" title="Alpa (A)">A</button>
                        </div>
                    </td>
                    <td class="col-pct">${weekly}%</td>
                    <td class="col-pct">${monthly}%</td>
                    <td class="col-pct">${yearly}%</td>
                    <td class="col-pct" style="font-weight: 700; color: ${overall >= 80 ? 'var(--secondary)' : 'var(--danger)'}">${overall}%</td>
                    <td class="admin-only ${currentUser && currentUser.role === 'admin' ? '' : 'hidden'}">
                        <button class="btn-sm-edit" onclick="editUser(${user.id})">Edit</button>
                        <button class="btn-sm-danger" onclick="deleteUser(${user.id})">Delete</button>
                    </td>
                `;
                attendanceBody.appendChild(row);
            });
        }

        if (avgAttendanceSpan) avgAttendanceSpan.textContent = `${users.length > 0 ? (totalPct / users.length).toFixed(1) : 0}%`;
        const statPresentEl = document.getElementById('stat-present-today');
        const statExcusedEl = document.getElementById('stat-excused-today');
        const statAlphaEl = document.getElementById('stat-alpha-today');
        if (statPresentEl) statPresentEl.textContent = countPresentToday;
        if (statExcusedEl) statExcusedEl.textContent = countExcusedToday;
        if (statAlphaEl) statAlphaEl.textContent = countAlphaToday;

        const adminCols = document.querySelectorAll('.admin-only');
        if (currentUser && currentUser.role === 'admin') adminCols.forEach(el => el.classList.remove('hidden'));
        else adminCols.forEach(el => el.classList.add('hidden'));
    };

    const updateUI = () => {
        if (!dashboardSection) return;
        if (!currentUser) {
            currentUser = { name: 'Pendidik', role: 'admin' };
            localStorage.setItem('myabsence_user', JSON.stringify(currentUser));
        }

        if (greeting) greeting.textContent = "Presensi Kelas";
        const todayDateDisplay = document.getElementById('today-date-display');
        if (todayDateDisplay) todayDateDisplay.textContent = formatIndonesianDate(new Date());
        if (currentDaySpan) currentDaySpan.textContent = calculateCurrentDay();
        if (currentUser.role === 'admin') {
            if (adminActions) adminActions.classList.remove('hidden');
            document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
            if (startDateInput) startDateInput.value = new Date(startDate).toISOString().split('T')[0];
        } else {
            if (adminActions) adminActions.classList.add('hidden');
            document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        }
        // Update share link button in navbar
        const shareBtn = navShareBtn || document.getElementById('nav-share-btn');
        const shareLabel = navShareLabel || document.getElementById('nav-share-label');
        if (shareBtn) {
            if (syncCode) {
                shareBtn.classList.add('connected');
                if (shareLabel) shareLabel.textContent = 'Link Terhubung';
            } else {
                shareBtn.classList.remove('connected');
                if (shareLabel) shareLabel.textContent = 'Bagikan Link';
            }
        }
        renderTable();
    };

    const CONFIRM_ICONS = {
        warning: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
        key: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>`,
        disconnect: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path><path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>`,
        success: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    };

    const showToast = (message, icon = 'success', duration = 3000) => {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast-item';
        const iconSvg = icon === 'success'
            ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
            : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        toast.innerHTML = `${iconSvg}<span>${message}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-fading');
            setTimeout(() => { toast.remove(); }, 250);
        }, duration);
    };

    let cachedNetworkInfo = null;
    const fetchNetworkInfo = async () => {
        if (cachedNetworkInfo) return cachedNetworkInfo;
        try {
            const res = await fetch('/api/system/network-info');
            if (res.ok) {
                const json = await res.json();
                if (json.data) cachedNetworkInfo = json.data;
            }
        } catch (e) {}
        return cachedNetworkInfo;
    };

    const buildShareUrl = async (code) => {
        if (!code) return '';
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (isLocal) {
            const net = await fetchNetworkInfo();
            if (net && net.networkUrl) {
                if (shareLinkTypeBadge) shareLinkTypeBadge.textContent = `Wi-Fi / LAN (${net.localIp})`;
                return `${net.networkUrl}/?sync=${code}`;
            }
        }

        if (shareLinkTypeBadge) {
            shareLinkTypeBadge.textContent = isLocal ? 'Lokal' : 'Online Cloud';
        }
        return `${window.location.origin}${window.location.pathname}?sync=${code}`;
    };

    const updateShareLinkDisplay = async () => {
        if (!shareLinkInput) return;
        if (!syncCode) {
            shareLinkInput.value = '';
            return;
        }
        shareLinkInput.value = 'Menyiapkan link berbagi...';
        const url = await buildShareUrl(syncCode);
        shareLinkInput.value = url;
    };

    const openSyncModal = () => {
        if (!syncModal) return;
        if (syncCode) {
            if (syncConnectedView) syncConnectedView.classList.remove('hidden');
            if (syncDisconnectedView) syncDisconnectedView.classList.add('hidden');
            updateShareLinkDisplay();
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
    // Masuk ke aplikasi langsung dari welcome screen
    if (enterAppBtn) {
        enterAppBtn.addEventListener('click', () => {
            currentUser = { name: 'Pendidik', role: 'admin' };
            localStorage.setItem('myabsence_user', JSON.stringify(currentUser));
            localStorage.setItem('myabsence_session_active', 'true');
            document.documentElement.setAttribute('data-session', 'active');
            if (authSection) authSection.classList.remove('active');
            if (dashboardSection) dashboardSection.classList.add('active');
            updateUI();
            if (syncCode) {
                pullSync(syncCode);
            }
        });
    }

    // --- Custom Confirmation Modal Helpers ---
    const showCustomConfirm = ({ title, message, icon = 'warning', okText = 'Ya, Lanjutkan', onOk }) => {
        if (confirmModalTitle) confirmModalTitle.textContent = title;
        if (confirmModalMsg) confirmModalMsg.textContent = message;
        if (confirmModalIcon) {
            confirmModalIcon.className = `confirm-modal-icon ${icon}`;
            confirmModalIcon.innerHTML = CONFIRM_ICONS[icon] || CONFIRM_ICONS.warning;
        }
        if (confirmModalOkBtn) confirmModalOkBtn.textContent = okText;
        onConfirmAction = onOk;
        if (confirmModal) confirmModal.classList.remove('hidden');
    };

    const closeCustomConfirm = () => {
        if (confirmModal) confirmModal.classList.add('hidden');
        onConfirmAction = null;
    };

    if (confirmModalCancelBtn) confirmModalCancelBtn.addEventListener('click', closeCustomConfirm);
    if (confirmModalOkBtn) confirmModalOkBtn.addEventListener('click', () => {
        if (typeof onConfirmAction === 'function') {
            onConfirmAction();
        }
        closeCustomConfirm();
    });

    // --- Sync Modal Event Handlers ---
    if (closeSyncModalBtn) closeSyncModalBtn.addEventListener('click', closeSyncModal);
    if (closeSyncModalBtn2) closeSyncModalBtn2.addEventListener('click', closeSyncModal);

    // Tombol Bagikan Link di Navbar
    if (navShareBtn) {
        navShareBtn.addEventListener('click', async () => {
            if (!syncCode) {
                syncCode = generateSyncCode();
                localStorage.setItem('myabsence_sync_code', syncCode);
                await pushSync();
                updateUI();
            }
            openSyncModal();
            const url = await buildShareUrl(syncCode);
            if (url && navigator.clipboard) {
                navigator.clipboard.writeText(url).then(() => {
                    showToast('Link Berbagi Berhasil Disalin!');
                    if (copyShareLinkText) {
                        copyShareLinkText.textContent = 'Tersalin!';
                        setTimeout(() => { copyShareLinkText.textContent = 'Salin Link'; }, 2000);
                    }
                }).catch(() => {});
            }
        });
    }

    // Salin Link Berbagi untuk HP
    if (copyShareLinkBtn) {
        copyShareLinkBtn.addEventListener('click', async () => {
            const url = shareLinkInput ? shareLinkInput.value : '';
            if (!url || url.startsWith('Menyiapkan')) return;
            try {
                await navigator.clipboard.writeText(url);
                showToast('Link Berbagi Berhasil Disalin!');
                if (copyShareLinkText) {
                    copyShareLinkText.textContent = 'Tersalin!';
                    setTimeout(() => { copyShareLinkText.textContent = 'Salin Link'; }, 2000);
                }
            } catch (e) {
                prompt('Salin link ini untuk dibuka di HP:', url);
            }
        });
    }

    if (shareLinkInput) {
        shareLinkInput.addEventListener('click', () => {
            shareLinkInput.select();
        });
    }

    // Buat link berbagi baru dari dalam dashboard
    if (modalGenerateCodeBtn) modalGenerateCodeBtn.addEventListener('click', async () => {
        const code = generateSyncCode();
        syncCode = code;
        localStorage.setItem('myabsence_sync_code', syncCode);
        await pushSync();
        updateUI();
        openSyncModal();
        showToast('Link Berbagi Baru Telah Dibuat!');
    });

    // Hubungkan via Link Berbagi
    if (modalConnectCodeBtn) modalConnectCodeBtn.addEventListener('click', async () => {
        let raw = modalSyncCodeInput ? modalSyncCodeInput.value.trim() : '';
        const urlMatch = raw.match(/[?&](?:sync|share|connect)=([A-Z0-9]{12})/i) || raw.match(/([A-Z0-9]{12})/i);
        if (!urlMatch) {
            alert('Link tidak valid. Pastikan Anda menempelkan link berbagi yang lengkap (contoh: http://192.168.x.x:3000/?sync=...).');
            return;
        }
        const token = urlMatch[1].toUpperCase();

        modalConnectCodeBtn.textContent = 'Menghubungkan...';
        modalConnectCodeBtn.disabled = true;
        const found = await pullSync(token);
        modalConnectCodeBtn.textContent = 'Buka & Hubungkan Link';
        modalConnectCodeBtn.disabled = false;
        if (!found) {
            showCustomConfirm({
                title: 'Sesi Tidak Ditemukan',
                message: `Sesi dari link ini belum terdaftar di server. Apakah ingin membuat sesi baru dengan link ini?`,
                icon: 'key',
                okText: 'Buat Sesi Baru',
                onOk: () => {
                    syncCode = token;
                    localStorage.setItem('myabsence_sync_code', syncCode);
                    pushSync();
                    updateUI();
                    openSyncModal();
                    showToast('Sesi Baru Dibuat & Terhubung!');
                }
            });
            return;
        }
        syncCode = token;
        localStorage.setItem('myabsence_sync_code', syncCode);
        pushSync();
        updateUI();
        openSyncModal();
        showToast('Berhasil Terhubung via Link!');
    });

    // Putuskan sinkronisasi dengan custom confirmation modal
    if (disconnectSyncBtn) disconnectSyncBtn.addEventListener('click', () => {
        showCustomConfirm({
            title: 'Putuskan Link Sesi?',
            message: 'Data di perangkat ini tetap aman, tapi tidak akan lagi tersinkron dengan HP sampai link dihubungkan kembali.',
            icon: 'disconnect',
            okText: 'Ya, Putuskan',
            onOk: () => {
                syncCode = null;
                localStorage.removeItem('myabsence_sync_code');
                updateUI();
                openSyncModal();
                showToast('Link sesi berhasil diputuskan.');
            }
        });
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.setItem('myabsence_session_active', 'false');
            document.documentElement.removeAttribute('data-session');
            try {
                if (window.history.replaceState) {
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            } catch (e) {}
            if (dashboardSection) dashboardSection.classList.remove('active');
            if (authSection) authSection.classList.add('active');
            showToast('Berhasil keluar ke tampilan awal.', 'info');
        });
    }
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
            if (idx !== -1) users[idx] = { ...users[idx], name, absence_number, attendanceLogs: modalLogs, updatedAt: Date.now() };
        } else {
            // Jika daftar saat ini hanya berisi dummy siswa default (Student 1, 2, 3 atau John Doe dll),
            // hapus otomatis data dummy tersebut sehingga siswa baru yang diinput menjadi siswa pertama
            if (hasOnlyDummyStudents(users)) {
                users = [];
            }
            const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
            const finalAbsNum = absence_number ? absence_number.trim() : String(newId).padStart(2, '0');
            users.push({ id: newId, name, absence_number: finalAbsNum, attendanceLogs: modalLogs, updatedAt: Date.now() });
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

    // --- Educator Extensions: Role Mode, Custom Mapel, Jam, Jurnal Mengajar, and Print ---
    const attendanceModeSelect = document.getElementById('attendance-mode-select');
    const subjectInputGroup = document.getElementById('subject-input-group');
    const periodInputGroup = document.getElementById('period-input-group');
    const subjectInput = document.getElementById('subject-input');
    const periodInput = document.getElementById('period-input');
    const lessonNotesInput = document.getElementById('lesson-notes-input');
    const journalLabel = document.getElementById('journal-label');
    const journalStatus = document.getElementById('journal-status');
    const printSheetBtn = document.getElementById('print-sheet-btn');

    function applyAttendanceMode(mode) {
        if (mode === 'subject') {
            if (subjectInputGroup) subjectInputGroup.classList.remove('hidden');
            if (periodInputGroup) periodInputGroup.classList.remove('hidden');
            if (journalLabel) journalLabel.textContent = 'Jurnal Mengajar & Catatan Materi';
            if (lessonNotesInput) lessonNotesInput.placeholder = 'Tuliskan materi yang dibahas hari ini, tugas yang diberikan, atau kejadian penting di kelas...';
        } else {
            if (subjectInputGroup) subjectInputGroup.classList.add('hidden');
            if (periodInputGroup) periodInputGroup.classList.add('hidden');
            if (journalLabel) journalLabel.textContent = 'Catatan Wali Kelas & Pembinaan Siswa';
            if (lessonNotesInput) lessonNotesInput.placeholder = 'Catatan pembinaan siswa, informasi wali kelas, kejadian khusus hari ini...';
        }
    }

    if (attendanceModeSelect) {
        const savedMode = localStorage.getItem('myabsence_mode') || 'homeroom';
        attendanceModeSelect.value = savedMode;
        applyAttendanceMode(savedMode);

        attendanceModeSelect.addEventListener('change', () => {
            const selectedMode = attendanceModeSelect.value;
            localStorage.setItem('myabsence_mode', selectedMode);
            applyAttendanceMode(selectedMode);
        });
    }

    if (subjectInput) {
        subjectInput.value = localStorage.getItem('myabsence_subject') || '';
        subjectInput.addEventListener('change', () => {
            localStorage.setItem('myabsence_subject', subjectInput.value.trim());
        });
    }

    if (periodInput) {
        periodInput.value = localStorage.getItem('myabsence_period') || '';
        periodInput.addEventListener('change', () => {
            localStorage.setItem('myabsence_period', periodInput.value.trim());
        });
    }

    if (lessonNotesInput) {
        const todayKey = toLocalISO(new Date());
        lessonNotesInput.value = localStorage.getItem('myabsence_journal_' + todayKey) || '';
        lessonNotesInput.addEventListener('input', () => {
            if (journalStatus) journalStatus.textContent = 'Mengetik...';
        });
        lessonNotesInput.addEventListener('blur', () => {
            localStorage.setItem('myabsence_journal_' + todayKey, lessonNotesInput.value.trim());
            if (journalStatus) journalStatus.textContent = 'Tersimpan otomatis';
        });
    }

    const updatePrintMeta = () => {
        const mode = localStorage.getItem('myabsence_mode') || 'homeroom';
        const subj = localStorage.getItem('myabsence_subject') || '-';
        const per = localStorage.getItem('myabsence_period') || '-';
        const todayStr = formatIndonesianDate(new Date());

        const pDate = document.getElementById('print-date-val');
        const pRole = document.getElementById('print-role-val');
        const pSubj = document.getElementById('print-subject-val');
        const pPer = document.getElementById('print-period-val');
        const pSignRole = document.getElementById('print-signature-role');

        if (pDate) pDate.textContent = todayStr;
        if (pRole) pRole.textContent = mode === 'subject' ? 'Guru Mata Pelajaran' : 'Wali Kelas';
        if (pSubj) pSubj.textContent = mode === 'subject' ? (subj || '-') : 'Presensi Harian Kelas';
        if (pPer) pPer.textContent = mode === 'subject' ? (per || '-') : 'Seharian';
        if (pSignRole) pSignRole.textContent = mode === 'subject' ? `Guru Mata Pelajaran (${subj || 'Mapel'})` : 'Wali Kelas';
    };

    if (printSheetBtn) {
        printSheetBtn.addEventListener('click', () => {
            updatePrintMeta();
            window.print();
        });
    }
    window.addEventListener('beforeprint', updatePrintMeta);

    // Toolbar Listeners: Live Search, Mark All Present, Reset Today
    const studentSearchInput = document.getElementById('student-search-input');
    const markAllPresentBtn = document.getElementById('mark-all-present-btn');
    const resetTodayBtn = document.getElementById('reset-today-btn');

    if (studentSearchInput) {
        studentSearchInput.addEventListener('input', () => {
            renderTable();
        });
    }

    if (markAllPresentBtn) {
        markAllPresentBtn.addEventListener('click', () => {
            window.markAllPresentToday();
        });
    }

    if (resetTodayBtn) {
        resetTodayBtn.addEventListener('click', () => {
            window.resetAllToday();
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

    if (exportMatrixBtn) {
        exportMatrixBtn.addEventListener('click', () => {
            if (!users || users.length === 0) {
                showToast('Belum ada data siswa untuk diekspor.', 'warning');
                return;
            }

            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const monthStr = (month + 1).toString().padStart(2, '0');
            const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            const monthName = monthNames[month];

            const dateHeaders = [];
            for (let d = 1; d <= daysInMonth; d++) {
                dateHeaders.push(`${year}-${monthStr}-${d.toString().padStart(2, '0')}`);
            }

            let sortedUsers = [...users];
            sortedUsers.sort((a, b) => (parseInt(a.absence_number) || 999) - (parseInt(b.absence_number) || 999));

            let csv = '\uFEFF';
            csv += 'LAPORAN REKAPITULASI PRESENSI BULANAN\n';
            csv += `Bulan:;${monthName} ${year}\n`;
            csv += `Pendidik / Wali Kelas:;${(currentUser && currentUser.name) ? currentUser.name : 'Pendidik'}\n`;
            csv += `Tanggal Ekspor:;${now.toLocaleDateString('id-ID')}\n\n`;

            const daysHeader = Array.from({ length: daysInMonth }, (_, i) => i + 1).join(';');
            csv += `No;No Absen;Nama Siswa;${daysHeader};Hadir (H);Sakit (S);Izin (I);Alpa (A);% Kehadiran\n`;

            sortedUsers.forEach((u, idx) => {
                const logs = u.attendanceLogs || {};
                let h = 0, s = 0, i = 0, a = 0;
                const dailyCodes = dateHeaders.map(dStr => {
                    const st = logs[dStr];
                    if (!st) return '-';
                    if (st === 'present' || st === 'late') { h++; return st === 'late' ? 'T' : 'H'; }
                    if (st === 'sick') { s++; return 'S'; }
                    if (st === 'permit') { i++; return 'I'; }
                    if (st === 'absent') { a++; return 'A'; }
                    return '-';
                });

                const activeInMonth = dateHeaders.filter(dStr => activeWorkdays.includes(dStr)).length;
                const totalEff = activeInMonth > 0 ? activeInMonth : (h + s + i + a);
                const pct = totalEff > 0 ? ((h / totalEff) * 100).toFixed(1) : '0.0';
                const safeName = (u.name || '').includes(';') ? `"${u.name.replace(/"/g, '""')}"` : (u.name || '');

                csv += `${idx + 1};${u.absence_number || String(idx + 1).padStart(2, '0')};${safeName};${dailyCodes.join(';')};${h};${s};${i};${a};${pct}%\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `Rekap_Presensi_Bulanan_${monthName}_${year}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast(`Rekap bulanan ${monthName} ${year} berhasil diunduh.`);
        });
    }

    if (importCsvBtn && csvImportInput) {
        importCsvBtn.addEventListener('click', () => {
            csvImportInput.value = '';
            csvImportInput.click();
        });
        
        csvImportInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target.result;
                if (!text || !text.trim()) {
                    showToast('File CSV kosong atau tidak valid.', 'warning');
                    return;
                }

                const cleanText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
                const lines = cleanText.split(/\r?\n/).filter(l => l.trim().length > 0);
                if (lines.length < 2) {
                    showToast('Format CSV minimal harus memiliki header dan 1 baris siswa.', 'warning');
                    return;
                }

                const detectDelim = (headerLine) => {
                    const sc = (headerLine.match(/;/g) || []).length;
                    const cc = (headerLine.match(/,/g) || []).length;
                    return sc > cc ? ';' : ',';
                };

                const parseLine = (csvLine, delimiter) => {
                    const result = [];
                    let cur = "";
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
                            cur = "";
                        } else cur += char;
                    }
                    result.push(cur.trim());
                    return result;
                };

                const delimiter = detectDelim(lines[0]);
                const headerParts = parseLine(lines[0], delimiter).map(h => h.toLowerCase().replace(/["']/g, '').trim());
                const isFullExport = headerParts.includes('detailed logs') || headerParts.includes('overall %') || (headerParts.length >= 8);

                const newUsers = [];
                try {
                    for (let i = 1; i < lines.length; i++) {
                        const parts = parseLine(lines[i], delimiter);
                        if (parts.length < 2) continue;

                        if (isFullExport && parts.length >= 8) {
                            const id = parseInt(parts[0], 10) || (Date.now() + i);
                            const absNum = parts[1].replace(/["']/g, '').trim() || String(i).padStart(2, '0');
                            const name = sanitizeStudentName(parts[2].replace(/["']/g, '').trim()) || `Student ${i}`;
                            
                            let logsRaw = (parts[7] || "").replace(/["']/g, '').trim();
                            const attendanceLogs = {};
                            if (logsRaw) {
                                if (logsRaw.includes('|') || logsRaw.includes(':')) {
                                    logsRaw.split('|').forEach(entry => {
                                        const [d, s] = entry.split(':');
                                        if (d && d.trim()) attendanceLogs[d.trim()] = (s && s.trim()) ? s.trim() : 'present';
                                    });
                                } else {
                                    logsRaw.split(',').forEach(d => {
                                        const trimmed = d.trim();
                                        if (trimmed) attendanceLogs[trimmed] = 'present';
                                    });
                                }
                            }
                            newUsers.push({ id, name, absence_number: absNum, attendanceLogs, updatedAt: Date.now() });
                        } else {
                            let absNum = '';
                            let name = '';
                            if (parts.length >= 3 && !isNaN(parseInt(parts[0], 10)) && !isNaN(parseInt(parts[1], 10))) {
                                absNum = parts[1].replace(/["']/g, '').trim();
                                name = sanitizeStudentName(parts[2].replace(/["']/g, '').trim());
                            } else {
                                absNum = parts[0].replace(/["']/g, '').trim();
                                name = sanitizeStudentName(parts[1].replace(/["']/g, '').trim());
                            }
                            if (name) {
                                newUsers.push({ id: Date.now() + i, name, absence_number: absNum || String(i).padStart(2, '0'), attendanceLogs: {}, updatedAt: Date.now() });
                            }
                        }
                    }

                    if (newUsers.length > 0) {
                        showCustomConfirm({
                            title: 'Pulihkan / Impor Data Siswa?',
                            message: `Ditemukan ${newUsers.length} data siswa dari CSV. Apakah Anda ingin memperbarui data kelas dengan daftar ini?`,
                            icon: 'info',
                            okText: 'Ya, Impor',
                            onOk: () => {
                                users = newUsers.map(u => ({
                                    ...u,
                                    presenceDates: Object.keys(u.attendanceLogs || {}).filter(d => u.attendanceLogs[d] === 'present')
                                }));
                                saveData();
                                renderTable();
                                showToast(`Berhasil mengimpor ${newUsers.length} data siswa!`);
                            }
                        });
                    } else {
                        showToast('Tidak ada data siswa valid yang terbaca dalam CSV.', 'warning');
                    }
                } catch (err) {
                    showToast('Gagal memproses CSV: ' + err.message, 'warning');
                }
            };
            reader.onerror = () => showToast('Gagal membaca berkas CSV.', 'warning');
            reader.readAsText(file);
        });
    }

    initPeriodSelectors();

    const isSessionActive = () => localStorage.getItem('myabsence_session_active') === 'true';

    // Jika URL membawa link berbagi ke HP atau sesi aktif, masuk langsung ke dashboard
    if (incomingShareCode || isSessionActive()) {
        localStorage.setItem('myabsence_session_active', 'true');
        document.documentElement.setAttribute('data-session', 'active');
        if (authSection) authSection.classList.remove('active');
        if (dashboardSection) dashboardSection.classList.add('active');
        updateUI();
    } else {
        localStorage.setItem('myabsence_session_active', 'false');
        document.documentElement.removeAttribute('data-session');
        if (authSection) authSection.classList.add('active');
        if (dashboardSection) dashboardSection.classList.remove('active');
    }

    // Auto-sync on startup if logged in with sync code
    if (currentUser && syncCode) {
        pullSync(syncCode).then((success) => {
            if (success && incomingShareCode) {
                showToast('Terhubung via Link Berbagi! Data presensi disinkronkan.', 'success', 4000);
                try {
                    window.history.replaceState({}, document.title, window.location.pathname);
                } catch (e) {}
            }
        });
    }

    // Periodic auto-sync for real-time multi-device sync (snappy 3.5s for local LAN)
    const syncIntervalMs = firestoreDb ? 10000 : 3500;
    setInterval(() => {
        if (currentUser && syncCode && !document.hidden) {
            pullSync(syncCode);
        }
    }, syncIntervalMs);

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
