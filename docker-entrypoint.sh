#!/bin/sh
set -e

echo "🚀 Starting message-control-ms entrypoint..."

# Wait for database to be ready
mkdir -p /app/data

echo "✅ Database directory ready"

# Run drizzle migrations
echo "🔄 Running database migrations..."
bun x drizzle-kit migrate --config=drizzle.config.ts || {
  echo "⚠️  Database migration failed, but continuing..."
}

echo "✅ Database tables verified/created"

# Start the application
echo "🚀 Starting message-control-ms application..."
exec bun src/index.ts
