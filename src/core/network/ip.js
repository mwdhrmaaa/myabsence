const os = require('os');
const env = require('../config/env');

function getLocalIp() {
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

function getNetworkInfo() {
    const localIp = getLocalIp();
    const port = env.port;
    return {
        localIp,
        port,
        networkUrl: `http://${localIp}:${port}`,
        localUrl: `http://localhost:${port}`
    };
}

module.exports = {
    getLocalIp,
    getNetworkInfo
};
