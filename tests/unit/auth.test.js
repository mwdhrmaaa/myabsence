const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword, generateToken, verifyToken } = require('../../src/features/auth/auth.service');

test('Auth Service - Password Hashing and Verification', () => {
    const password = 'SuperSecretEducatorPassword2026';
    const hash = hashPassword(password);

    assert.ok(hash.includes(':'), 'Hash must contain salt delimiter');
    assert.strictEqual(verifyPassword(password, hash), true, 'Valid password should verify');
    assert.strictEqual(verifyPassword('WrongPassword', hash), false, 'Incorrect password must fail');
});

test('Auth Service - HMAC-SHA256 Token Lifecycle', () => {
    const userPayload = { id: 42, username: 'sensei', role: 'teacher' };
    const token = generateToken(userPayload);

    assert.ok(typeof token === 'string');
    assert.strictEqual(token.split('.').length, 3, 'JWT must have header.data.sig format');

    const decoded = verifyToken(token);
    assert.strictEqual(decoded.id, 42);
    assert.strictEqual(decoded.username, 'sensei');
    assert.strictEqual(decoded.role, 'teacher');

    // Tampered token must fail
    const tampered = token.slice(0, -4) + 'abcd';
    assert.strictEqual(verifyToken(tampered), null, 'Tampered token must be rejected');
});
