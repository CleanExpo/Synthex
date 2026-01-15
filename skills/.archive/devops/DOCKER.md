---
name: docker
version: 1.0.0
description: Docker patterns and best practices
author: Your Team
priority: 3
triggers:
  - docker
  - container
  - image
---

# Docker Patterns

## Multi-Stage Build

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only necessary files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
```

## Python Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen --no-dev

# Copy source
COPY src/ ./src/

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uv", "run", "uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Docker Compose

```yaml
version: "3.8"

services:
  frontend:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000
    depends_on:
      - backend

  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    env_file:
      - .env.local
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## .dockerignore

```
node_modules
.next
.git
*.md
.env*
.vscode
__pycache__
*.pyc
.pytest_cache
.mypy_cache
.venv
```

## Best Practices

### 1. Use Specific Tags
```dockerfile
# Good
FROM node:20.10-alpine

# Bad
FROM node:latest
```

### 2. Minimize Layers
```dockerfile
# Good - single RUN command
RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*

# Bad - multiple RUN commands
RUN apt-get update
RUN apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*
```

### 3. Non-Root User
```dockerfile
RUN addgroup --system app && adduser --system --group app
USER app
```

### 4. Health Checks
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1
```

## Commands

```bash
# Build image
docker build -t myapp:latest .

# Run container
docker run -d -p 3000:3000 --name myapp myapp:latest

# View logs
docker logs -f myapp

# Execute command in container
docker exec -it myapp sh

# Docker Compose
docker compose up -d
docker compose down
docker compose logs -f
```

## Verification

- [ ] Image builds successfully
- [ ] Container starts without errors
- [ ] Health check passes
- [ ] Application responds correctly
- [ ] Logs are accessible
