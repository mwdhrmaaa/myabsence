FROM node:24-alpine AS base

WORKDIR /app

COPY package.json ./

COPY src/ ./src/
COPY public/ ./public/
COPY server.js ./

EXPOSE 3000

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

VOLUME ["/app/data"]

CMD ["node", "server.js"]
