const syncRepository = require('./sync.repository');
const { getNetworkInfo } = require('../../core/network/ip');

class SyncService {
    saveSession(code, payload) {
        if (!code || typeof code !== 'string') {
            throw new Error('Sync code is required and must be a string');
        }
        const cleanCode = code.trim().toUpperCase();
        const updatedAt = payload && payload.updatedAt ? Number(payload.updatedAt) : Date.now();
        return syncRepository.upsertSession(cleanCode, payload, updatedAt);
    }

    getSession(code) {
        if (!code || typeof code !== 'string') {
            return null;
        }
        const cleanCode = code.trim().toUpperCase();
        return syncRepository.getSession(cleanCode);
    }

    getNetworkShareInfo(code) {
        const netInfo = getNetworkInfo();
        const cleanCode = code ? code.trim().toUpperCase() : '';
        return {
            ...netInfo,
            code: cleanCode,
            shareUrl: cleanCode ? `${netInfo.networkUrl}/?sync=${cleanCode}` : netInfo.networkUrl,
            localShareUrl: cleanCode ? `${netInfo.localUrl}/?sync=${cleanCode}` : netInfo.localUrl
        };
    }
}

module.exports = new SyncService();
