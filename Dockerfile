# ── Stage 1: Build the React client ──────────────────────────────────────────
FROM node:20-alpine AS client-builder

WORKDIR /build/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# ── Stage 2: Production server ────────────────────────────────────────────────
FROM node:20-alpine

# better-sqlite3 requires python/make for native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install server dependencies
COPY server/package*.json ./
RUN npm install --omit=dev

# Copy server source
COPY server/ ./

# Copy built React app → served as static files
COPY --from=client-builder /build/client/dist ./public

# Data volume: books, covers, sqlite db live here
ENV DATA_DIR=/data
VOLUME ["/data"]

EXPOSE 3000

CMD ["node", "src/index.js"]
