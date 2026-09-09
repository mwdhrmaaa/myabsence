const { getDatabase } = require('../../core/database/connection');

class SyncRepository {
    constructor(db) {
        this.db = db || getDatabase();
    }

    upsertSession(code, payload, updatedAt = Date.now()) {
        const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const stmt = this.db.prepare(`
            INSERT INTO sync_sessions (code, payload, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(code) DO UPDATE SET
                payload = excluded.payload,
                updated_at = excluded.updated_at
        `);
        stmt.run(code, payloadStr, updatedAt);
        return { code, updatedAt };
    }

    getSession(code) {
        const stmt = this.db.prepare('SELECT code, payload, updated_at FROM sync_sessions WHERE code = ?');
        const row = stmt.get(code);
        if (!row) return null;

        try {
            return {
                code: row.code,
                data: JSON.parse(row.payload),
                updatedAt: row.updated_at
            };
        } catch {
            return {
                code: row.code,
                data: row.payload,
                updatedAt: row.updated_at
            };
        }
    }

    deleteSession(code) {
        const stmt = this.db.prepare('DELETE FROM sync_sessions WHERE code = ?');
        const result = stmt.run(code);
        return result.changes > 0;
    }
}

module.exports = new SyncRepository();
