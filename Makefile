# Synthex Docker Management
.PHONY: help build dev prod stop clean logs test

# Default target
help:
	@echo "Synthex Docker Commands:"
	@echo "  make build     - Build Docker images"
	@echo "  make dev       - Start development environment"
	@echo "  make prod      - Start production environment"
	@echo "  make stop      - Stop all services"
	@echo "  make clean     - Clean up containers and volumes"
	@echo "  make logs      - View logs from all services"
	@echo "  make test      - Run tests in container"
	@echo "  make shell     - Open shell in app container"

# Build Docker images
build:
	docker-compose build --no-cache

# Start development environment
dev:
	docker-compose up -d
	@echo "Development environment started!"
	@echo "Application: http://localhost:3000"
	@echo "Prometheus: http://localhost:9090"
	@echo "Grafana: http://localhost:3001 (admin/admin)"

# Start production environment
prod:
	docker-compose -f docker-compose.prod.yml up -d
	@echo "Production environment started!"

# Stop all services
stop:
	docker-compose down
	docker-compose -f docker-compose.prod.yml down

# Clean up everything
clean:
	docker-compose down -v --remove-orphans
	docker-compose -f docker-compose.prod.yml down -v --remove-orphans
	docker system prune -f
	docker volume prune -f

# View logs
logs:
	docker-compose logs -f

# Run tests
test:
	docker-compose exec app npm test

# Open shell in app container
shell:
	docker-compose exec app sh

# Database operations
db-migrate:
	docker-compose exec app npm run db:migrate

db-seed:
	docker-compose exec app npm run db:seed

# Health check
health:
	@echo "Checking services health..."
	@curl -f http://localhost:3000/health || echo "App: DOWN"
	@curl -f http://localhost:9090/-/healthy || echo "Prometheus: DOWN"
	@curl -f http://localhost:3001/api/health || echo "Grafana: DOWN"

# Restart specific service
restart-app:
	docker-compose restart app

restart-db:
	docker-compose restart postgres

restart-redis:
	docker-compose restart redis
