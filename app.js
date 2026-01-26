document.addEventListener('DOMContentLoaded', () => {
    // Configuration & State
    let startDate = localStorage.getItem('myabsence_start_date') ? parseInt(localStorage.getItem('myabsence_start_date')) : new Date('2026-01-12').getTime();
    const ADMIN_CREDENTIALS = { username: 'admin', password: 'admin123' };
    const USER_CREDENTIALS = { username: 'user', password: 'user123' };

    let currentUser = JSON.parse(localStorage.getItem('myabsence_user')) || null;
    
    // Initial users with migration logic
    let rawUsers = JSON.parse(localStorage.getItem('myabsence_data')) || [
        { id: 1, name: 'John Doe', presentDays: 12 },
        { id: 2, name: 'Jane Smith', presentDays: 10 },
        { id: 3, name: 'Alice Johnson', presentDays: 8 }
    ];

    // Migrate to presenceDates if necessary
    let users = rawUsers.map(u => {
        if (!u.presenceDates) {
            const dates = [];
            // Dummy migration: fill dates from start date
            for(let i=0; i < (u.presentDays || 0); i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                dates.push(d.toISOString().split('T')[0]);
            }
            return { id: u.id, name: u.name, presenceDates: dates };
        }
        return u;
    });

    // Temp state for modal
    let modalDates = [];

    // Selectors
    const authSection = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
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
    
    // New selectors
    const logDateInput = document.getElementById('log-date-input');
    const addDateBtn = document.getElementById('add-date-btn');
    const selectedDatesList = document.getElementById('selected-dates-list');

    // --- Core Logic ---

    const calculateCurrentDay = () => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const diffTime = now.getTime() - start.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays > 0 ? diffDays : 0;
    };

    const getPeriodPercentage = (presenceDates, daysBack) => {
        const totalProgramDays = calculateCurrentDay();
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        let effectiveDaysInPeriod;
        let cutoffDate;

        if (daysBack === Infinity) {
            effectiveDaysInPeriod = totalProgramDays;
            cutoffDate = new Date(startDate);
        } else {
            effectiveDaysInPeriod = Math.min(daysBack, totalProgramDays);
            cutoffDate = new Date();
            cutoffDate.setDate(now.getDate() - (daysBack - 1));
            cutoffDate.setHours(0, 0, 0, 0);
            
            // Should not go before program start
            if (cutoffDate.getTime() < startDate) {
                cutoffDate = new Date(startDate);
            }
        }

        if (effectiveDaysInPeriod <= 0) return "0.0";

        const presentCount = presenceDates.filter(dateStr => {
            const d = new Date(dateStr);
            return d.getTime() >= cutoffDate.getTime() && d.getTime() <= now.getTime();
        }).length;

        return ((presentCount / effectiveDaysInPeriod) * 100).toFixed(1);
    };

    const saveData = () => {
        localStorage.setItem('myabsence_data', JSON.stringify(users));
    };

    const renderTable = () => {
        attendanceBody.innerHTML = '';
        let totalOverallPercentage = 0;

        users.forEach(user => {
            const weekly = getPeriodPercentage(user.presenceDates, 7);
            const monthly = getPeriodPercentage(user.presenceDates, 30);
            const yearly = getPeriodPercentage(user.presenceDates, 365);
            const overall = getPeriodPercentage(user.presenceDates, Infinity);
            
            totalOverallPercentage += parseFloat(overall);

            const todayStr = new Date().toISOString().split('T')[0];
            const isPresentToday = user.presenceDates.includes(todayStr);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.name}</td>
                <td class="admin-only ${currentUser && currentUser.role === 'admin' ? '' : 'hidden'}">
                    <button class="${isPresentToday ? 'btn-checkedin' : 'btn-checkin'}" onclick="togglePresenceToday(${user.id})">
                        ${isPresentToday ? 'Checked-in' : 'Mark Present'}
                    </button>
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
            displayName.textContent = currentUser.name;
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

    const renderModalDates = () => {
        selectedDatesList.innerHTML = '';
        modalDates.sort().reverse().forEach(date => {
            const tag = document.createElement('div');
            tag.className = 'tag';
            tag.innerHTML = `
                ${date}
                <span class="tag-remove" onclick="removeModalDate('${date}')">×</span>
            `;
            selectedDatesList.appendChild(tag);
        });
    };

    window.removeModalDate = (date) => {
        modalDates = modalDates.filter(d => d !== date);
        renderModalDates();
    };

    window.togglePresenceToday = (userId) => {
        const user = users.find(u => u.id === userId);
        if (!user) return;

        const todayStr = new Date().toISOString().split('T')[0];
        if (user.presenceDates.includes(todayStr)) {
            user.presenceDates = user.presenceDates.filter(d => d !== todayStr);
        } else {
            user.presenceDates.push(todayStr);
        }
        
        saveData();
        renderTable();
    };

    // --- Event Handlers ---

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const userVal = document.getElementById('username').value;
        const passVal = document.getElementById('password').value;

        if (userVal === ADMIN_CREDENTIALS.username && passVal === ADMIN_CREDENTIALS.password) {
            currentUser = { name: 'Super Admin', role: 'admin' };
            localStorage.setItem('myabsence_user', JSON.stringify(currentUser));
            updateUI();
        } else if (userVal === USER_CREDENTIALS.username && passVal === USER_CREDENTIALS.password) {
            currentUser = { name: 'Regular User', role: 'user' };
            localStorage.setItem('myabsence_user', JSON.stringify(currentUser));
            updateUI();
        } else {
            loginError.textContent = 'Invalid username or password';
        }
    });

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
        renderModalDates();
        userModal.classList.remove('hidden');
    });

    addDateBtn.addEventListener('click', () => {
        const val = logDateInput.value;
        if (val && !modalDates.includes(val)) {
            modalDates.push(val);
            renderModalDates();
        }
    });

    closeModal.addEventListener('click', () => {
        userModal.classList.add('hidden');
    });

    userForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-user-id').value;
        const name = document.getElementById('user-fullname').value;

        if (id) {
            const index = users.findIndex(u => u.id == id);
            users[index] = { ...users[index], name, presenceDates: modalDates };
        } else {
            const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
            users.push({ id: newId, name, presenceDates: modalDates });
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
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' } // Changed to landscape for more columns
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

    window.editUser = (id) => {
        const user = users.find(u => u.id === id);
        if (!user) return;

        modalTitle.textContent = 'Edit User';
        document.getElementById('edit-user-id').value = user.id;
        document.getElementById('user-fullname').value = user.name;
        modalDates = [...user.presenceDates];
        renderModalDates();
        userModal.classList.remove('hidden');
    };

    window.deleteUser = (id) => {
        users = users.filter(u => u.id !== id);
        saveData();
        renderTable();
    };

    // Initialize
    updateUI();
});
