document.addEventListener('DOMContentLoaded', () => {
    // Configuration
    const START_DATE = new Date('2026-01-12').getTime(); // Example start date
    const ADMIN_CREDENTIALS = { username: 'admin', password: 'admin123' };
    const USER_CREDENTIALS = { username: 'user', password: 'user123' };

    // State
    let currentUser = JSON.parse(localStorage.getItem('myabsence_user')) || null;
    let users = JSON.parse(localStorage.getItem('myabsence_data')) || [
        { id: 1, name: 'John Doe', presentDays: 12 },
        { id: 2, name: 'Jane Smith', presentDays: 10 },
        { id: 3, name: 'Alice Johnson', presentDays: 8 }
    ];

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

    // --- Core Logic ---

    const calculateCurrentDay = () => {
        const diffTime = Math.abs(Date.now() - START_DATE);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const saveData = () => {
        localStorage.setItem('myabsence_data', JSON.stringify(users));
    };

    const renderTable = () => {
        const totalDays = calculateCurrentDay();
        attendanceBody.innerHTML = '';
        
        let totalPercentage = 0;

        users.forEach(user => {
            const percentage = ((user.presentDays / totalDays) * 100).toFixed(1);
            totalPercentage += parseFloat(percentage);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.name}</td>
                <td>${user.presentDays}</td>
                <td>${totalDays}</td>
                <td style="font-weight: 700; color: ${percentage >= 80 ? 'var(--secondary)' : 'var(--danger)'}">${percentage}%</td>
                <td class="${currentUser && currentUser.role === 'admin' ? '' : 'hidden'}">
                    <button class="btn-sm-edit" onclick="editUser(${user.id})">Edit</button>
                    <button class="btn-sm-danger" onclick="deleteUser(${user.id})">Delete</button>
                </td>
            `;
            attendanceBody.appendChild(row);
        });

        const avg = users.length > 0 ? (totalPercentage / users.length).toFixed(1) : 0;
        avgAttendanceSpan.textContent = `${avg}%`;

        // Update actions visibility
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

            if (currentUser.role === 'admin') {
                adminActions.classList.remove('hidden');
            } else {
                adminActions.classList.add('hidden');
            }
            renderTable();
        }
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
        userModal.classList.remove('hidden');
    });

    closeModal.addEventListener('click', () => {
        userModal.classList.add('hidden');
    });

    userForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-user-id').value;
        const name = document.getElementById('user-fullname').value;
        const presentDays = parseInt(document.getElementById('user-present').value);

        if (id) {
            // Edit
            const index = users.findIndex(u => u.id == id);
            users[index] = { ...users[index], name, presentDays };
        } else {
            // Add
            const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
            users.push({ id: newId, name, presentDays });
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
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    });

    // --- Global functions for inline Event Listeners ---
    window.editUser = (id) => {
        const user = users.find(u => u.id === id);
        if (!user) return;

        modalTitle.textContent = 'Edit User';
        document.getElementById('edit-user-id').value = user.id;
        document.getElementById('user-fullname').value = user.name;
        document.getElementById('user-present').value = user.presentDays;
        userModal.classList.remove('hidden');
    };

    window.deleteUser = (id) => {
        if (confirm('Are you sure you want to delete this user?')) {
            users = users.filter(u => u.id !== id);
            saveData();
            renderTable();
        }
    };

    // Initialize
    updateUI();
});
