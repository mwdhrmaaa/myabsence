document.addEventListener('DOMContentLoaded', () => {
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
        if (!u.presenceDates) {
            const dates = [];
            for(let i=0; i < (u.presentDays || 0); i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                dates.push(d.toISOString().split('T')[0]);
            }
            return { ...u, presenceDates: dates };
        }
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
    let modalDates = [];
    let currentViewDate = new Date();
    let isRanked = false;

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

    // --- 3. Global Actions ---

    window.togglePresenceToday = (userId) => {
        const user = users.find(u => u.id === userId);
        if (!user) return;
        const todayStr = new Date().toISOString().split('T')[0];
        if (!activeWorkdays.includes(todayStr)) return;
        if (user.presenceDates.includes(todayStr)) {
            user.presenceDates = user.presenceDates.filter(d => d !== todayStr);
        } else {
            user.presenceDates.push(todayStr);
        }
        saveData();
        renderTable();
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
        modalDates = [...user.presenceDates];
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

    const toLocalISO = (date) => {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const getPeriodPercentage = (presenceDates, type) => {
        const now = new Date();
        const todayStr = toLocalISO(now);
        const programStartStr = toLocalISO(new Date(startDate));
        
        // Boundaries
        let periodStartStr, periodEndStr;

        if (type === 'weekly') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(now);
            monday.setDate(diff);
            periodStartStr = toLocalISO(monday);
            periodEndStr = "9999-12-31"; // Use today cap below
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

        // Adjust boundaries
        const finalStart = (periodStartStr > programStartStr) ? periodStartStr : programStartStr;
        const finalEnd = (periodEndStr < todayStr) ? periodEndStr : todayStr;

        const workdaysInPeriod = activeWorkdays.filter(dStr => dStr >= finalStart && dStr <= finalEnd);
        
        const total = workdaysInPeriod.length;
        if (total === 0) return "0.0";

        const present = presenceDates.filter(dStr => workdaysInPeriod.includes(dStr)).length;
        return ((present / total) * 100).toFixed(1);
    };

    const saveData = () => {
        localStorage.setItem('myabsence_data', JSON.stringify(users));
        localStorage.setItem('myabsence_workdays', JSON.stringify(activeWorkdays));
    };

    const renderTable = () => {
        if (!attendanceBody) return;
        attendanceBody.innerHTML = '';
        let totalPct = 0;

        // Sorting Logic
        let displayUsers = [...users];
        if (isRanked) {
            displayUsers.sort((a, b) => {
                const pctA = parseFloat(getPeriodPercentage(a.presenceDates, 'overall'));
                const pctB = parseFloat(getPeriodPercentage(b.presenceDates, 'overall'));

                // Special Priority Rule: "I Made Mahendra Wira Dharma" (No. 8) at 100%
                const priorityName = "I Made Mahendra Wira Dharma";
                const isMahendraA = (a.name.toLowerCase() === priorityName.toLowerCase() && (a.absence_number === '8' || a.absence_number === '08') && pctA === 100);
                const isMahendraB = (b.name.toLowerCase() === priorityName.toLowerCase() && (b.absence_number === '8' || b.absence_number === '08') && pctB === 100);

                if (isMahendraA) return -1;
                if (isMahendraB) return 1;

                return pctB - pctA; // Standard Descending
            });
        }

        displayUsers.forEach(user => {
            const weekly = getPeriodPercentage(user.presenceDates, 'weekly');
            const monthly = getPeriodPercentage(user.presenceDates, 'monthly');
            const yearly = getPeriodPercentage(user.presenceDates, 'yearly');
            const overall = getPeriodPercentage(user.presenceDates, 'overall');
            totalPct += parseFloat(overall);
            const todayStr = toLocalISO(new Date());
            const isPresentToday = user.presenceDates.includes(todayStr);
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
            renderTable();
        }
    };

    const renderHistoryGrid = () => {
        if (!historyDaysGrid) return;
        historyDaysGrid.innerHTML = '';
        const now = new Date();
        const todayStr = toLocalISO(now);
        const year = now.getFullYear(), month = now.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const dateStr = toLocalISO(date);
            const isPresent = modalDates.includes(dateStr);
            const isWorkday = activeWorkdays.includes(dateStr);
            const isFuture = dateStr > todayStr;
            
            const btn = document.createElement('button');
            btn.type = 'button';
            // Only show active if marked present AND it is an active workday
            btn.className = `day-btn ${ (isPresent && isWorkday) ? 'active' : ''} ${isFuture ? 'future' : (!isWorkday ? 'disabled' : '')}`;
            btn.textContent = i;
            
            if (isWorkday && !isFuture) {
                btn.onclick = () => {
                    if (modalDates.includes(dateStr)) modalDates = modalDates.filter(d => d !== dateStr);
                    else modalDates.push(dateStr);
                    renderHistoryGrid();
                };
            }
            historyDaysGrid.appendChild(btn);
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
            btn.className = `day-btn ${isActive ? 'active' : ''} ${isFuture ? 'future' : ''}`;
            btn.textContent = i;
            btn.onclick = () => {
                if (activeWorkdays.includes(dateStr)) activeWorkdays = activeWorkdays.filter(d => d !== dateStr);
                else activeWorkdays.push(dateStr);
                renderWorkdaysGrid();
                saveData();
                renderTable();
            };
            workdaysGrid.appendChild(btn);
        }
    };

    // --- 5. Event Handlers ---
    if (enterBtn) enterBtn.addEventListener('click', () => {
        currentUser = { name: 'Sensei!', role: 'admin' };
        localStorage.setItem('myabsence_user', JSON.stringify(currentUser));
        updateUI();
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
        if (historyToggle) historyToggle.classList.remove('active');
        if (historyGridContainer) historyGridContainer.classList.add('hidden');
        if (userModal) userModal.classList.remove('hidden');
    });
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => { if (userModal) userModal.classList.add('hidden'); });
    if (userForm) userForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-user-id').value;
        const name = document.getElementById('user-fullname').value;
        const absence_number = document.getElementById('user-absence-number').value;
        if (id) {
            const idx = users.findIndex(u => u.id == id);
            if (idx !== -1) users[idx] = { ...users[idx], name, absence_number, presenceDates: modalDates };
        } else {
            const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
            users.push({ id: newId, name, absence_number, presenceDates: modalDates });
        }
        saveData();
        renderTable();
        if (userModal) userModal.classList.add('hidden');
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
            let csvContent = "ID,Absence Number,Name,Weekly %,Monthly %,Yearly %,Overall %,Presence Dates\n";
            
            // CSV Rows
            users.forEach(user => {
                const weekly = getPeriodPercentage(user.presenceDates, 'weekly');
                const monthly = getPeriodPercentage(user.presenceDates, 'monthly');
                const yearly = getPeriodPercentage(user.presenceDates, 'yearly');
                const overall = getPeriodPercentage(user.presenceDates, 'overall');
                
                // Quote presence dates to handle commas
                const datesStr = `"${user.presenceDates.join(", ")}"`;
                
                csvContent += `${user.id},${user.absence_number || user.id},${user.name},${weekly},${monthly},${yearly},${overall},${datesStr}\n`;
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
        importCsvBtn.addEventListener('click', () => csvImportInput.click());
        csvImportInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target.result;
                const lines = text.split('\n').filter(l => l.trim() !== '');
                if (lines.length < 2) return;
                
                const newUsers = [];
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];
                    // Robust CSV splitting to handle quoted commas
                    const regex = /(".*?"|[^",]+)(?=\s*,|\s*$)/g;
                    const parts = [];
                    let m;
                    while ((m = regex.exec(line)) !== null) {
                        parts.push(m[0].trim());
                    }

                    if (parts.length >= 8) {
                        const id = parseInt(parts[0]);
                        const absNum = parts[1];
                        const name = parts[2].replace(/"/g, '');
                        // skip 3,4,5,6 (percents)
                        let datesRaw = parts[7].replace(/"/g, '');
                        const presenceDates = datesRaw ? datesRaw.split(',').map(d => d.trim()).filter(d => d !== '') : [];
                        
                        newUsers.push({ id, name, absence_number: absNum, presenceDates });
                    }
                }
                
                if (newUsers.length > 0) {
                    if (confirm(`Restore ${newUsers.length} users? This will replace current data.`)) {
                        users = newUsers;
                        saveData();
                        renderTable();
                    }
                }
                csvImportInput.value = '';
            };
            reader.readAsText(file);
        });
    }

    initPeriodSelectors();
    updateUI();
});
