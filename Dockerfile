FROM oven/bun:1.3.13-alpine

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json bun.lock ./

# Install dependencies including better-sqlite3
RUN bun install --frozen-lockfile

# Copy source code
COPY src/ ./src/

# Create data directory for SQLite
RUN mkdir -p ./data

# Expose port
EXPOSE 3007

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3007/api/health || exit 1

# Run the application
CMD ["bun", "src/index.ts"]
