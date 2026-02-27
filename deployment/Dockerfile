# =============================================================================
# Synthex API Server - Production Dockerfile
# =============================================================================
#
# SECURITY NOTES:
#   - No secrets, credentials, or API keys should appear in this file
#   - All sensitive configuration is injected via environment variables at runtime
#   - The .dockerignore file prevents .env files from being copied into the image
#   - Runs as non-root user (nodejs:1001) for defense in depth
#   - Uses multi-stage-ready structure (add build stage if needed)
#
# BUILD:
#   docker build -t synthex-api -f deployment/Dockerfile .
#
# RUN:
#   docker run --env-file .env -p 3000:3000 synthex-api
# =============================================================================

FROM node:20-alpine

# Install dependencies for native modules and health checks
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl

# Create app directory
WORKDIR /app

# Copy package files first (for Docker layer caching)
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --only=production

# Generate Prisma client
RUN npx prisma generate

# Copy application files
# IMPORTANT: .dockerignore must exclude .env, .env.local, and other secret files
COPY dist ./dist
COPY public ./public

# Create non-root user for running the application
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user (never run containers as root in production)
USER nodejs

# Expose application port (configurable via PORT env var, defaults to 3000)
EXPOSE 3000

# Health check - verifies the application is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
# All configuration is provided via environment variables at runtime
CMD ["node", "dist/index.js"]
