const url = require('url');
const { sendNotFound, sendError } = require('./response');

class Router {
    constructor() {
        this.routes = [];
    }

    add(method, pattern, handler) {
        const paramNames = [];
        const regexPattern = pattern.replace(/:([a-zA-Z0-9_]+)/g, (_, key) => {
            paramNames.push(key);
            return '([^/]+)';
        });
        const regex = new RegExp(`^${regexPattern}$`);
        this.routes.push({ method: method.toUpperCase(), regex, paramNames, handler });
    }

    get(pattern, handler) { this.add('GET', pattern, handler); }
    post(pattern, handler) { this.add('POST', pattern, handler); }
    put(pattern, handler) { this.add('PUT', pattern, handler); }
    delete(pattern, handler) { this.add('DELETE', pattern, handler); }

    async handle(req, res) {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        const method = req.method.toUpperCase();

        req.query = parsedUrl.query || {};

        if (['POST', 'PUT', 'PATCH'].includes(method)) {
            try {
                req.body = await this.parseBody(req);
            } catch (err) {
                return sendError(res, 400, 'Invalid JSON body');
            }
        } else {
            req.body = {};
        }

        for (const route of this.routes) {
            if (route.method === method) {
                const match = pathname.match(route.regex);
                if (match) {
                    req.params = {};
                    route.paramNames.forEach((name, index) => {
                        req.params[name] = decodeURIComponent(match[index + 1]);
                    });
                    try {
                        return await route.handler(req, res);
                    } catch (error) {
                        console.error('[Router Error]', error);
                        return sendError(res, 500, 'Internal server error', error.message);
                    }
                }
            }
        }

        return sendNotFound(res, `Route ${method} ${pathname} not found`);
    }

    parseBody(req) {
        return new Promise((resolve, reject) => {
            let data = '';
            req.on('data', chunk => {
                data += chunk;
                if (data.length > 10 * 1024 * 1024) { // 10MB limit
                    req.destroy();
                    reject(new Error('Payload too large'));
                }
            });
            req.on('end', () => {
                if (!data) return resolve({});
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
            req.on('error', reject);
        });
    }
}

module.exports = Router;
