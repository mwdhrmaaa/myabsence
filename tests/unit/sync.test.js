const test = require('node:test');
const assert = require('node:assert/strict');
const syncService = require('../../src/features/sync/sync.service');
const syncRepository = require('../../src/features/sync/sync.repository');

test('Sync Engine - Cross-Device Session Storage and Network Share', () => {
    const testCode = 'TEST99XYZ001';
    const testPayload = {
        users: [
            { id: 1, name: 'Student 1', attendanceLogs: { '2026-09-09': 'present' } },
            { id: 2, name: 'Student 2', attendanceLogs: { '2026-09-09': 'sick' } }
        ],
        workdays: ['2026-09-09'],
        startDate: '2026-09-01',
        updatedAt: 1725880000000
    };

    // 1. Save sync session
    const saveResult = syncService.saveSession(testCode, testPayload);
    assert.strictEqual(saveResult.code, testCode);

    // 2. Retrieve sync session
    const retrieved = syncService.getSession(testCode);
    assert.ok(retrieved, 'Session should exist');
    assert.strictEqual(retrieved.code, testCode);
    assert.strictEqual(retrieved.data.users.length, 2);
    assert.strictEqual(retrieved.data.users[0].name, 'Student 1');
    assert.strictEqual(retrieved.data.users[1].attendanceLogs['2026-09-09'], 'sick');

    // 3. Network Share Info Generation
    const shareInfo = syncService.getNetworkShareInfo(testCode);
    assert.ok(shareInfo.localIp, 'Should detect local IP');
    assert.ok(shareInfo.shareUrl.includes(testCode), 'Share URL should contain the sync code');
    assert.ok(shareInfo.shareUrl.startsWith('http://'), 'Share URL should be a valid http link');

    // 4. Update session
    const updatedPayload = { ...testPayload, updatedAt: 1725881000000 };
    syncService.saveSession(testCode, updatedPayload);
    const retrievedUpdated = syncService.getSession(testCode);
    assert.strictEqual(retrievedUpdated.updatedAt, 1725881000000);

    // Cleanup
    syncRepository.deleteSession(testCode);
    const cleaned = syncService.getSession(testCode);
    assert.strictEqual(cleaned, null);
});
