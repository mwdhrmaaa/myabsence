const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const env = require('../config/env');

let instance = null;

function getDatabase(customPath) {
    if (instance) return instance;

    const targetPath = customPath || env.dbPath;
    const dbDir = path.dirname(targetPath);

    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    instance = new DatabaseSync(targetPath);
    instance.exec('PRAGMA foreign_keys = ON;');
    instance.exec('PRAGMA journal_mode = WAL;');
    instance.exec('PRAGMA synchronous = NORMAL;');

    initializeSchema(instance);
    return instance;
}

function initializeSchema(db) {
    const schemaFile = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaFile)) {
        const schema = fs.readFileSync(schemaFile, 'utf-8');
        db.exec(schema);
    }
}

function closeDatabase() {
    if (instance) {
        instance.close();
        instance = null;
    }
}

module.exports = {
    getDatabase,
    closeDatabase
};
