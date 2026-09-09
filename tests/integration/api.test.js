const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const server = require('../../server');
const env = require('../../src/core/config/env');

function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: env.port,
            path,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, body: parsed });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        req.end();
    });
}

test('API Integration - Full HTTP Endpoints Pipeline', async (t) => {
    // 1. List Classes
    const classesRes = await request('/api/classes');
    assert.strictEqual(classesRes.status, 200);
    assert.ok(classesRes.body.data.classes.length >= 1);
    const activeClass = classesRes.body.data.classes[0];

    // 2. Fetch or Create Session
    const sessionRes = await request(`/api/attendance/session?classId=${activeClass.id}&date=2026-09-09`);
    assert.strictEqual(sessionRes.status, 200);
    assert.ok(sessionRes.body.data.session.id);
    const session = sessionRes.body.data.session;
    const student = sessionRes.body.data.students[0];

    // 3. Record Attendance
    const recordRes = await request('/api/attendance/record', {
        method: 'POST',
        body: {
            sessionId: session.id,
            studentId: student.id,
            status: 'present',
            note: 'Integration Test Check'
        }
    });
    assert.strictEqual(recordRes.status, 200);
    assert.strictEqual(recordRes.body.data.record.status, 'present');

    // 4. Analytics
    const analyticsRes = await request(`/api/analytics/classes/${activeClass.id}`);
    assert.strictEqual(analyticsRes.status, 200);
    assert.ok(typeof analyticsRes.body.data.overallRate === 'number');

    // Close server when integration tests finish
    server.close();
});
