document.addEventListener('DOMContentLoaded', () => {
    // Configuration & State
    let startDate = localStorage.getItem('myabsence_start_date') ? parseInt(localStorage.getItem('myabsence_start_date')) : new Date('2026-01-12').getTime();

    let currentUser = JSON.parse(localStorage.getItem('myabsence_user')) || null;
    
    // Quick fix: Update old session name if exists
    if (currentUser && currentUser.name === 'Super Admin') {
        currentUser.name = 'Sensei!';
        localStorage.setItem('myabsence_user', JSON.stringify(currentUser));
    }
    
    // Initial users with migration logic
    let rawUsers = JSON.parse(localStorage.getItem('myabsence_data')) || [
        { id: 1, name: 'John Doe', absence_number: '01', presentDays: 12 },
        { id: 2, name: 'Jane Smith', absence_number: '02', presentDays: 10 },
        { id: 3, name: 'Alice Johnson', absence_number: '03', presentDays: 8 }
    ];

    // Migration logic
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

    // Active Workdays State
    let activeWorkdays = [];
    try {
        const storedWorkdays = localStorage.getItem('myabsence_workdays');
        activeWorkdays = storedWorkdays ? JSON.parse(storedWorkdays) : [];
        if (!Array.isArray(activeWorkdays)) activeWorkdays = [];
    } catch (e) {
        console.error("Error parsing workdays", e);
        activeWorkdays = [];
    }
    
    // View State
    let selectedMonth = new Date().getMonth();
    let selectedYear = new Date().getFullYear();

    // Temp state for modals
    let modalDates = [];
    let currentViewDate = new Date(); // For month navigation in workday modal

    // Selectors
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
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    const userModal = document.getElementById('user-modal');
    const userForm = document.getElementById('user-form');
    const closeModal = document.getElementById('close-modal');
    const modalTitle = document.getElementById('modal-title');
    const avgAttendanceSpan = document.getElementById('avg-attendance');
    const startDateInput = document.getElementById('start-date-input');
    
    // Period Selectors
    const viewMonthSelect = document.getElementById('view-month');
    const viewYearSelect = document.getElementById('view-year');

    // History Selectors
    const historyToggle = document.getElementById('history-toggle');
    const historyGridContainer = document.getElementById('history-grid-container');
    const historyDaysGrid = document.getElementById('history-days-grid');

    // Workdays Selectors
    const manageWorkdaysBtn = document.getElementById('manage-workdays-btn');
    const workdaysModal = document.getElementById('workdays-modal');
    const workdaysGrid = document.getElementById('workdays-grid');
    const currentMonthDisplay = document.getElementById('current-month-display');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const closeWorkdaysModal = document.getElementById('close-workdays-modal');

    // --- Core Logic ---

    const initPeriodSelectors = () => {
        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        
        viewMonthSelect.innerHTML = months.map((m, i) => 
            `<option value="${i}" ${i === selectedMonth ? 'selected' : ''}>${m}</option>`
        ).join('');

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

    const getPeriodPercentage = (presenceDates, type) => {
        const now = new Date();
        const programStart = new Date(startDate);
        programStart.setHours(0, 0, 0, 0);

        // Period end boundary: End of selected Month/Year OR today if it's the current period
        const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
        const endOfSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0);
        endOfSelectedMonth.setHours(23, 59, 59, 999);

        const periodEndBoundary = isCurrentMonth ? now : endOfSelectedMonth;
        periodEndBoundary.setHours(23, 59, 59, 999);

        let periodStart;
        if (type === 'weekly') {
            // Monday of the week containing periodEndBoundary
            periodStart = new Date(periodEndBoundary);
            const day = periodStart.getDay();
            const diff = periodStart.getDate() - day + (day === 0 ? -6 : 1);
            periodStart.setDate(diff);
        } else if (type === 'monthly') {
            periodStart = new Date(selectedYear, selectedMonth, 1);
        } else if (type === 'yearly') {
            periodStart = new Date(selectedYear, 0, 1);
        } else {
            periodStart = programStart;
        }

        // Clip start to program start date
        if (periodStart.getTime() < programStart.getTime()) {
            periodStart = programStart;
        }
        periodStart.setHours(0, 0, 0, 0);

        // Filter active workdays in this period up to periodEndBoundary
        const workdaysInPeriod = activeWorkdays.filter(dateStr => {
            const d = new Date(dateStr);
            return d.getTime() >= periodStart.getTime() && d.getTime() <= periodEndBoundary.getTime();
        });

        const totalWorkdays = workdaysInPeriod.length;
        if (totalWorkdays === 0) return "0.0";

        const presentInPeriod = presenceDates.filter(dateStr => {
            return workdaysInPeriod.includes(dateStr);
        }).length;

        return ((presentInPeriod / totalWorkdays) * 100).toFixed(1);
    };

    const saveData = () => {
        localStorage.setItem('myabsence_data', JSON.stringify(users));
        localStorage.setItem('myabsence_workdays', JSON.stringify(activeWorkdays));
    };

    const renderTable = () => {
        attendanceBody.innerHTML = '';
        let totalOverallPercentage = 0;

        users.forEach(user => {
            const weekly = getPeriodPercentage(user.presenceDates, 'weekly');
            const monthly = getPeriodPercentage(user.presenceDates, 'monthly');
            const yearly = getPeriodPercentage(user.presenceDates, 'yearly');
            const overall = getPeriodPercentage(user.presenceDates, 'overall');
            
            totalOverallPercentage += parseFloat(overall);

            const todayStr = new Date().toISOString().split('T')[0];
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

        const avg = users.length > 0 ? (totalOverallPercentage / users.length).toFixed(1) : 0;
        avgAttendanceSpan.textContent = `${avg}%`;

        const adminCols = document.querySelectorAll('.admin-only');
        if (currentUser && currentUser.role === 'admin') {
            adminCols.forEach(el => el.classList.remove('hidden'));
        } else {
            adminCols.forEach(el => el.classList.add('hidden'));
        }
    };

    const updateUI = () => {
        if (!currentUser) {
            authSection.classList.add('active');
            dashboardSection.classList.remove('active');
        } else {
            authSection.classList.remove('active');
            dashboardSection.classList.add('active');
            displayName.textContent = currentUser.role === 'admin' ? 'Admin' : currentUser.name;
            greeting.textContent = `Welcome back, ${currentUser.name}!`;
            currentDaySpan.textContent = calculateCurrentDay();

            const adminOnlyElements = document.querySelectorAll('.admin-only');
            if (currentUser.role === 'admin') {
                adminActions.classList.remove('hidden');
                adminOnlyElements.forEach(el => el.classList.remove('hidden'));
                const d = new Date(startDate);
                startDateInput.value = d.toISOString().split('T')[0];
            } else {
                adminActions.classList.add('hidden');
                adminOnlyElements.forEach(el => el.classList.add('hidden'));
            }
            renderTable();
        }
    };

    const renderHistoryGrid = () => {
        historyDaysGrid.innerHTML = '';
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayStr = now.toISOString().split('T')[0];

        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const dateStr = date.toISOString().split('T')[0];
            const isPresent = modalDates.includes(dateStr);
            const isWorkday = activeWorkdays.includes(dateStr);
            const isFuture = date.getTime() > now.getTime();
            const isToday = dateStr === todayStr;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `day-btn ${isPresent ? 'active' : ''} ${isFuture ? 'future' : (!isWorkday ? 'disabled' : '')}`;
            btn.textContent = i;
            
            if (isWorkday && !isFuture) {
                btn.title = isToday ? 'Today' : dateStr;
                btn.onclick = () => {
                    if (modalDates.includes(dateStr)) {
                        modalDates = modalDates.filter(d => d !== dateStr);
                    } else {
                        modalDates.push(dateStr);
                    }
                    renderHistoryGrid();
                };
            } else if (!isWorkday) {
                btn.title = "Non-workday";
            }
            historyDaysGrid.appendChild(btn);
        }
    };

    const renderWorkdaysGrid = () => {
        workdaysGrid.innerHTML = '';
        const year = currentViewDate.getFullYear();
        const month = currentViewDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        currentMonthDisplay.textContent = currentViewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const dateStr = date.toISOString().split('T')[0];
            const isActive = activeWorkdays.includes(dateStr);
            const isFuture = date.getTime() > now.getTime();

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `day-btn ${isActive ? 'active' : ''} ${isFuture ? 'future' : ''}`;
            btn.textContent = i;
            btn.onclick = () => {
                if (activeWorkdays.includes(dateStr)) {
                    activeWorkdays = activeWorkdays.filter(d => d !== dateStr);
                } else {
                    activeWorkdays.push(dateStr);
                }
                renderWorkdaysGrid();
                saveData();
                renderTable();
            };
            workdaysGrid.appendChild(btn);
        }
    };

    // --- Event Handlers ---

    viewMonthSelect.addEventListener('change', (e) => {
        selectedMonth = parseInt(e.target.value);
        renderTable();
    });

    viewYearSelect.addEventListener('change', (e) => {
        selectedYear = parseInt(e.target.value);
        renderTable();
    });

    historyToggle.addEventListener('click', () => {
        historyToggle.classList.toggle('active');
        historyGridContainer.classList.toggle('hidden');
        if (!historyGridContainer.classList.contains('hidden')) {
            renderHistoryGrid();
        }
    });

    window.openWorkdaysModal = () => {
        currentViewDate = new Date();
        renderWorkdaysGrid();
        workdaysModal.classList.remove('hidden');
    };

    window.changeWorkdayMonth = (diff) => {
        currentViewDate.setMonth(currentViewDate.getMonth() + diff);
        renderWorkdaysGrid();
    };

    window.closeWorkdaysModal = () => {
        workdaysModal.classList.add('hidden');
    };

    if (enterBtn) {
        enterBtn.addEventListener('click', () => {
            currentUser = { name: 'Sensei!', role: 'admin' };
            localStorage.setItem('myabsence_user', JSON.stringify(currentUser));
            updateUI();
        });
    }

    logoutBtn.addEventListener('click', () => {
        currentUser = null;
        localStorage.removeItem('myabsence_user');
        updateUI();
    });

    addUserBtn.addEventListener('click', () => {
        modalTitle.textContent = 'Add New User';
        document.getElementById('edit-user-id').value = '';
        userForm.reset();
        modalDates = [];
        historyToggle.classList.remove('active');
        historyGridContainer.classList.add('hidden');
        userModal.classList.remove('hidden');
    });

    closeModal.addEventListener('click', () => {
        userModal.classList.add('hidden');
    });

    userForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-user-id').value;
        const name = document.getElementById('user-fullname').value;
        const absence_number = document.getElementById('user-absence-number').value;

        if (id) {
            const index = users.findIndex(u => u.id == id);
            users[index] = { ...users[index], name, absence_number, presenceDates: modalDates };
        } else {
            const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
            users.push({ id: newId, name, absence_number, presenceDates: modalDates });
        }

        saveData();
        renderTable();
        userModal.classList.add('hidden');
    });

    downloadPdfBtn.addEventListener('click', () => {
        const element = document.querySelector('.table-container');
        const opt = {
            margin:       1,
            filename:     `Attendance_Report_${new Date().toLocaleDateString()}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, backgroundColor: '#0f172a' },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
        };
        html2pdf().set(opt).from(element).save();
    });

    startDateInput.addEventListener('change', (e) => {
        const newDate = new Date(e.target.value).getTime();
        if (newDate) {
            startDate = newDate;
            localStorage.setItem('myabsence_start_date', startDate);
            currentDaySpan.textContent = calculateCurrentDay();
            renderTable();
        }
    });

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

        modalTitle.textContent = 'Edit User';
        document.getElementById('edit-user-id').value = user.id;
        document.getElementById('user-fullname').value = user.name;
        document.getElementById('user-absence-number').value = user.absence_number || '';
        modalDates = [...user.presenceDates];
        
        historyToggle.classList.remove('active');
        historyGridContainer.classList.add('hidden');
        
        userModal.classList.remove('hidden');
    };

    window.deleteUser = (id) => {
        users = users.filter(u => u.id !== id);
        saveData();
        renderTable();
    };

    // Initialize
    initPeriodSelectors();
    updateUI();
});
