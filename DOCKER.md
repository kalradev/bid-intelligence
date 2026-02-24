# Run Bid Intelligence with Docker

## Prerequisites

1. **Docker Desktop** installed and **running** (on Windows: start Docker Desktop and wait until it’s ready).
2. In the project root (folder that contains `docker-compose.yml`, `Backend_py`, and `Frontend`).

## Quick run

```bash
docker-compose up --build -d
```

- **Frontend:** http://localhost (port 80)  
- **Backend API:** http://localhost:8000  

First run can take a few minutes (build + Postgres startup).

## Optional: Backend env (API keys, JWT)

For AI features and a secure JWT secret:

1. Copy `Backend_py/.env.example` to `Backend_py/.env`.
2. Fill in at least: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `JWT_SECRET`.
3. In `docker-compose.yml`, under the `backend` service, add:

   ```yaml
   env_file:
     - ./Backend_py/.env
   ```

4. Restart: `docker-compose up -d`.

## Useful commands

| Command | Description |
|--------|-------------|
| `docker-compose up -d` | Start containers in background |
| `docker-compose up --build -d` | Rebuild and start |
| `docker-compose down` | Stop and remove containers |
| `docker-compose logs -f backend` | Follow backend logs |
| `docker-compose ps` | List running containers |

## Troubleshooting

- **“Cannot connect to Docker”** → Start Docker Desktop and wait until it’s running.
- **Port 80 or 8000 in use** → Change in `docker-compose.yml` (e.g. `"3080:80"` for frontend, `"8001:8000"` for backend).
- **Backend can’t reach DB** → Ensure `postgres` service is healthy; first start may take ~30 seconds.
