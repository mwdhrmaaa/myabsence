# MyAbsence v2.0

> Next-Generation Attendance & Student Analytics Platform for Global Educators.

---

## Overview

**MyAbsence v2.0** is an attendance and classroom management platform engineered to replace brittle spreadsheets and monolithic legacy trackers. It provides a multi-class, multi-subject hierarchy with real-time analytics, automated early warning detection, and zero-friction deployment.

---

## Key Features

- **Multi-Class & Multi-Subject Hierarchy**: Seamlessly manage multiple classes, grade levels, and course subjects with instant switching.
- **Relational Integrity (ACID SQLite)**: Powered by Node.js native `node:sqlite` for in-process reliability, zero external binary drivers, and ACID transactions.
- **Early Warning Radar**: Automated detection of students with attendance drops (<75%) or consecutive unexcused absences (3+ alpha).
- **Batch Attendance Operations**: One-click "Mark All Present" presets, multi-status recording (Present, Late, Sick, Permit, Absent), and inline student notes.
- **Roster Management & CSV Interop**: Instant CSV import and export for student rosters and attendance records.
- **Progressive Web App (PWA)**: Offline-first design with service worker support and mobile responsiveness.
- **Production-Grade Aesthetics**: Linear and Raycast-inspired neutral dark palette, zero raw emojis, and crisp accessible SVG icons.

---

## Architecture & Directory Structure

```text
myabsence/
├── Dockerfile                  # Container definition
├── docker-compose.yml          # Production container orchestration
├── deploy.sh                   # Single-enter Linux/macOS deployment
├── deploy.ps1                  # Single-enter Windows PowerShell deployment
├── redeploy.sh                 # Zero-friction updates
├── runtest.sh                  # Automated test runner
├── package.json
├── server.js                   # High-performance server entrypoint (< 120 lines)
├── src/
│   ├── core/
│   │   ├── config/             # Environment variables & constants
│   │   ├── database/           # Relational schema, SQLite connection, seeder
│   │   └── http/               # Lightweight router & standardized responses
│   └── features/
│       ├── auth/               # HMAC-SHA256 tokens & scrypt password hashing
│       ├── classes/            # Multi-class domain service & controller
│       ├── students/           # Student roster & CSV processor
│       ├── attendance/         # Attendance sessions & record recording
│       └── analytics/          # Class statistics & early warning detection
├── public/
│   ├── index.html              # HTML5 application shell
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Offline caching service worker
│   ├── css/
│   │   └── style.css           # Neutral dark design system
│   └── js/
│       └── app.js              # Reactive client application logic
└── tests/
    ├── unit/                   # Isolated domain logic tests
    └── integration/            # HTTP API endpoint tests
```

---

## Quick Start

### Windows (PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

### Linux / macOS (Bash)

```bash
chmod +x deploy.sh
./deploy.sh
```

### Docker Compose

```bash
docker compose up -d --build
```

---

## Testing

Run the automated test suite:

```bash
npm test
```

---

## Default Credentials

- **Username**: `teacher`
- **Password**: `teacher123`
- **URL**: `http://localhost:3000`

---

## License

MIT - Authored by [Mahendra Wira Dharma](https://github.com/mwdhrmaaa)
