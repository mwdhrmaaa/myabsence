const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const syncRepoModule = require('../../src/features/sync/sync.repository');

test('Sync TTL Pruning - prunes sessions older than cutoff and keeps recent ones', () => {
    const memDb = new DatabaseSync(':memory:');
    const schemaPath = path.join(__dirname, '../../src/core/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    memDb.exec(schema);

    // Create a local repo instance with in-memory DB
    const repo = new syncRepoModule.constructor(memDb);

    const now = Date.now();
    const eightDaysAgo = now - (8 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000);

    // Insert 1 expired session and 1 active session
    repo.upsertSession('EXPIRED1', { test: 'old' }, eightDaysAgo);
    repo.upsertSession('ACTIVE01', { test: 'fresh' }, twoDaysAgo);

    assert.ok(repo.getSession('EXPIRED1'));
    assert.ok(repo.getSession('ACTIVE01'));

    // Prune with 7-day TTL (7 * 24 * 60 * 60 * 1000)
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const prunedCount = repo.pruneExpiredSessions(sevenDaysMs);

    assert.equal(prunedCount, 1);
    assert.equal(repo.getSession('EXPIRED1'), null);
    assert.notEqual(repo.getSession('ACTIVE01'), null);
    assert.equal(repo.getSession('ACTIVE01').data.test, 'fresh');
});
