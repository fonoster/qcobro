FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
COPY mods/common/package*.json ./mods/common/
COPY mods/agents/package*.json ./mods/agents/
COPY mods/apiserver/package*.json ./mods/apiserver/

RUN npm ci --workspace=mods/common --workspace=mods/agents --workspace=mods/apiserver

COPY mods/common ./mods/common
COPY mods/agents ./mods/agents
COPY mods/apiserver ./mods/apiserver

RUN npm run build --workspace=mods/common
RUN npm run build --workspace=mods/agents
RUN npm run build --workspace=mods/apiserver

RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -s /bin/sh -D nodejs
USER nodejs

ENV NODE_ENV=production PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "mods/apiserver/dist/index.js"]
