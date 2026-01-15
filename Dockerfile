# Multi-stage build for production optimization
FROM node:22-alpine AS base

# Set working directory
WORKDIR /usr/src/app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    librsvg-dev

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN npm ci --include=dev
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
ENV NODE_ENV=production
RUN npm ci --only=production --ignore-scripts
COPY . .
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:22-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S synthex -u 1001

# Set working directory
WORKDIR /usr/src/app

# Install runtime dependencies only
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    librsvg

# Copy built application
COPY --from=build --chown=synthex:nodejs /usr/src/app/dist ./dist
COPY --from=build --chown=synthex:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=synthex:nodejs /usr/src/app/package*.json ./
COPY --from=build --chown=synthex:nodejs /usr/src/app/prisma ./prisma
COPY --from=build --chown=synthex:nodejs /usr/src/app/public ./public

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER synthex

# Expose port
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => { process.exit(1); });"

# Start application
CMD ["npm", "run", "start:prod"]
