FROM oven/bun:1.3.13-alpine

WORKDIR /app

# Install build dependencies and wget for health checks
RUN apk add --no-cache python3 make g++ wget

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src/ ./src/

# Copy drizzle config and migrations
COPY drizzle.config.ts ./
COPY drizzle/ ./drizzle/

# Copy docker-entrypoint.sh
COPY docker-entrypoint.sh ./

# Create data directory
RUN mkdir -p ./data

# Make docker-entrypoint.sh executable
RUN chmod +x docker-entrypoint.sh

# Expose port
EXPOSE 3007

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3007/api/health || exit 1

# Run the application
ENTRYPOINT ["./docker-entrypoint.sh"]
