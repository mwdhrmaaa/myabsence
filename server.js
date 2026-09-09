const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const env = require('./src/core/config/env');
const { getDatabase, closeDatabase } = require('./src/core/database/connection');
const { seedDatabase } = require('./src/core/database/seed');
const { createApiRouter } = require('./src/core/http/routes');

const PUBLIC_DIR = path.join(__dirname, 'public');
const apiRouter = createApiRouter();

// Initialize DB and Seed Data
const db = getDatabase();
seedDatabase(db);

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

function handleStaticFile(req, res, urlPath) {
    let normalized = urlPath === '/' ? '/index.html' : urlPath;
    const safePath = path.normalize(path.join(PUBLIC_DIR, normalized));

    if (!safePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Access Denied');
    }

    fs.readFile(safePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                const indexPath = path.join(PUBLIC_DIR, 'index.html');
                fs.readFile(indexPath, (readErr, indexContent) => {
                    if (readErr) {
                        res.writeHead(404, { 'Content-Type': 'text/plain' });
                        return res.end('Not Found');
                    }
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(indexContent);
                });
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server Error');
            }
            return;
        }

        const ext = path.extname(safePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
        });
        res.end(content);
    });
}

const server = http.createServer(async (req, res) => {
    // Set Security & CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    const urlPath = req.url.split('?')[0];

    if (urlPath.startsWith('/api/')) {
        return apiRouter.handle(req, res);
    }

    handleStaticFile(req, res, urlPath);
});

server.listen(env.port, env.host, () => {
    const localIp = getLocalIP();
    console.log(`[MyAbsence v2.0 Platform Ready]`);
    console.log(`- Local Access   : http://localhost:${env.port}`);
    console.log(`- Network Access : http://${localIp}:${env.port}`);
    console.log(`- Environment    : ${env.isDev ? 'Development' : 'Production'}\n`);
});

process.on('SIGINT', () => {
    console.log('\n[MyAbsence] Shutting down gracefully...');
    closeDatabase();
    server.close(() => process.exit(0));
});

module.exports = server;
