# PatchMon Docker

## Overview

PatchMon is a containerised application that monitors system patches and updates. The application consists of three main services:

- **Database**: PostgreSQL 17
- **Backend**: Node.js API server
- **Frontend**: React application served via Nginx

## Images

- **Backend**: [ghcr.io/9technologygroup/patchmon-backend:latest](https://github.com/9technologygroup/patchmon.net/pkgs/container/patchmon-backend)
- **Frontend**: [ghcr.io/9technologygroup/patchmon-frontend:latest](https://github.com/9technologygroup/patchmon.net/pkgs/container/patchmon-frontend)

Version tags are also available (e.g. `1.2.3`) for both of these images.

## Quick Start

### Production Deployment

1. Download the [Docker Compose file](docker-compose.yml)
2. Change the default database password in the file:
   ```yaml
   environment:
     POSTGRES_PASSWORD: YOUR_SECURE_PASSWORD_HERE
   ```
3. Update the corresponding `DATABASE_URL` in the backend service:
   ```yaml
   environment:
     DATABASE_URL: postgresql://patchmon_user:YOUR_SECURE_PASSWORD_HERE@database:5432/patchmon_db
   ```
4. Configure environment variables (see [Configuration](#configuration) section)
5. Start the application:
   ```bash
   docker compose up -d
   ```
6. Access the application at `http://localhost:3000`

## Updating

To update PatchMon to the latest version:

```bash
docker compose up -d --pull
```

This command will:
- Pull the latest images from the registry
- Recreate containers with updated images
- Maintain your data and configuration

### Version-Specific Updates

If you're using specific version tags instead of `latest` in your compose file:

1. Update the image tags in your `docker-compose.yml`. For example:
   ```yaml
   services:
     backend:
       image: ghcr.io/9technologygroup/patchmon-backend:1.2.7  # Update version here
      ...
     frontend:
       image: ghcr.io/9technologygroup/patchmon-frontend:1.2.7  # Update version here
      ...
   ```

2. Then run the update command:
   ```bash
   docker compose up -d --pull
   ```

> [!TIP]
> Check the [releases page](https://github.com/9technologygroup/patchmon.net/releases) for version-specific changes and migration notes.

## Configuration

### Environment Variables

#### Database Service

- `POSTGRES_DB`: Database name (default: `patchmon_db`)
- `POSTGRES_USER`: Database user (default: `patchmon_user`)
- `POSTGRES_PASSWORD`: Database password - **MUST BE CHANGED!**

#### Backend Service

- `LOG_LEVEL`: Logging level (`debug`, `info`, `warn`, `error`)
- `DATABASE_URL`: PostgreSQL connection string
- `PM_DB_CONN_MAX_ATTEMPTS`: Maximum database connection attempts (default: 30)
- `PM_DB_CONN_WAIT_INTERVAL`: Wait interval between connection attempts in seconds (default: 2)
- `SERVER_PROTOCOL`: Frontend server protocol (`http` or `https`)
- `SERVER_HOST`: Frontend server host (default: `localhost`)
- `SERVER_PORT`: Frontend server port (default: 3000)
- `PORT`: Backend API port (default: 3001)
- `API_VERSION`: API version (default: `v1`)
- `CORS_ORIGIN`: CORS origin URL
- `RATE_LIMIT_WINDOW_MS`: Rate limiting window in milliseconds (default: 900000)
- `RATE_LIMIT_MAX`: Maximum requests per window (default: 100)
- `ENABLE_HSTS`: Enable HTTP Strict Transport Security (default: true)
- `TRUST_PROXY`: Trust proxy headers (default: true) - See [Express.js docs](https://expressjs.com/en/guide/behind-proxies.html) for usage.

#### Frontend Service

- `BACKEND_HOST`: Backend service hostname (default: `backend`)
- `BACKEND_PORT`: Backend service port (default: 3001)

### Volumes

The compose file creates two Docker volumes:

* `postgres_data`: PostgreSQL's data directory.
* `agent_files`: PatchMon's agent files.

If you wish to bind either if their respective container paths to a host path rather than a Docker volume, you can do so in the Docker Compose file.

> [!TIP]
> The backend container runs as user & group ID 1000. If you plan to re-bind the agent files directory, ensure that the same user and/or group ID has permission to write to the host path to which it's bound.

---

# Development

This section is for developers who want to contribute to PatchMon or run it in development mode.

## Development Setup

For development with live reload and source code mounting:

1. Clone the repository:
   ```bash
   git clone https://github.com/9technologygroup/patchmon.net.git
   cd patchmon.net
   ```

2. Start development environment:
   ```bash
   docker compose -f docker/docker-compose.dev.yml up
   ```
   _See [Development Commands](#development-commands) for more options._

3. Access the application:
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:3001`
   - Database: `localhost:5432`

## Development Docker Compose

The development compose file (`docker/docker-compose.dev.yml`):
- Builds images locally from source using development targets
- Enables hot reload with Docker Compose watch functionality
- Exposes database and backend ports for testing and development
- Mounts source code directly into containers for live development
- Supports debugging with enhanced logging

## Building Images Locally

Both Dockerfiles use multi-stage builds with separate development and production targets:

```bash
# Build development images
docker build -f docker/backend.Dockerfile --target development -t patchmon-backend:dev .
docker build -f docker/frontend.Dockerfile --target development -t patchmon-frontend:dev .

# Build production images (default target)
docker build -f docker/backend.Dockerfile -t patchmon-backend:latest .
docker build -f docker/frontend.Dockerfile -t patchmon-frontend:latest .
```

## Development Commands

### Hot Reload Development
```bash
# Attached, live log output, services stopped on Ctrl+C
docker compose -f docker/docker-compose.dev.yml up

# Attached with Docker Compose watch for hot reload
docker compose -f docker/docker-compose.dev.yml up --watch

# Detached
docker compose -f docker/docker-compose.dev.yml up -d

# Quiet, no log output, with Docker Compose watch for hot reload
docker compose -f docker/docker-compose.dev.yml watch
```

### Rebuild Services
```bash
# Rebuild specific service
docker compose -f docker/docker-compose.dev.yml up -d --build backend

# Rebuild all services
docker compose -f docker/docker-compose.dev.yml up -d --build
```

### Development Ports
The development setup exposes additional ports for debugging:
- **Database**: `5432` - Direct PostgreSQL access
- **Backend**: `3001` - API server with development features
- **Frontend**: `3000` - React development server with hot reload

## Development Workflow

1. **Initial Setup**: Clone repository and start development environment
   ```bash
   git clone https://github.com/9technologygroup/patchmon.net.git
   cd patchmon.net
   docker compose -f docker/docker-compose.dev.yml up -d --build
   ```

2. **Hot Reload Development**: Use Docker Compose watch for automatic reload
   ```bash
   docker compose -f docker/docker-compose.dev.yml up --watch --build
   ```

3. **Code Changes**: 
   - **Frontend/Backend Source**: Files are synced automatically with watch mode
   - **Package.json Changes**: Triggers automatic service rebuild
   - **Prisma Schema Changes**: Backend service restarts automatically

4. **Database Access**: Connect database client directly to `localhost:5432`

5. **Debug**: If started with `docker compose [...] up -d` or `docker compose [...] watch`, check logs manually:
   ```bash
   docker compose -f docker/docker-compose.dev.yml logs -f
   ```
   Otherwise logs are shown automatically in attached modes (`up`, `up --watch`).

### Features in Development Mode

- **Hot Reload**: Automatic code synchronization and service restarts
- **Enhanced Logging**: Detailed logs for debugging
- **Direct Access**: Exposed ports for database and API debugging  
- **Health Checks**: Built-in health monitoring for services
- **Volume Persistence**: Development data persists between restarts
