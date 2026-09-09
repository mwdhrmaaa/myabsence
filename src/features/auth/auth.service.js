const crypto = require('crypto');
const env = require('../../core/config/env');
const { getDatabase } = require('../../core/database/connection');

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
    if (!storedHash || !storedHash.includes(':')) return false;
    const [salt, key] = storedHash.split(':');
    const hashBuffer = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, 'hex');
    return crypto.timingSafeEqual(hashBuffer, keyBuffer);
}

function generateToken(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const data = Buffer.from(JSON.stringify({
        ...payload,
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    })).toString('base64url');
    const signature = crypto.createHmac('sha256', env.jwtSecret)
        .update(`${header}.${data}`)
        .digest('base64url');
    return `${header}.${data}.${signature}`;
}

function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, data, signature] = parts;

    const expectedSig = crypto.createHmac('sha256', env.jwtSecret)
        .update(`${header}.${data}`)
        .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null; // Expired
        }
        return payload;
    } catch {
        return null;
    }
}

function login(identifier, password) {
    const db = getDatabase();
    const user = db.prepare(`
        SELECT id, username, email, password_hash, full_name, role
        FROM users
        WHERE username = ? OR email = ?
    `).get(identifier, identifier);

    if (!user || !verifyPassword(password, user.password_hash)) {
        return null;
    }

    const token = generateToken({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
    });

    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.full_name,
            role: user.role
        }
    };
}

module.exports = {
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    login
};
