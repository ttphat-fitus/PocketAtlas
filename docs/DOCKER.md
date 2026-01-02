# Docker Setup Guide for Pocket Atlas

## Overview

This document provides detailed instructions for building and running the Pocket Atlas application using Docker. This setup is designed for easy testing, development, and deployment.

## Architecture

Pocket Atlas uses a multi-container architecture:
- **Frontend Container**: Next.js application (Port 3000)
- **Backend Container**: FastAPI application (Port 8000)
- **Network**: Both containers communicate on a shared Docker network

## Files Included

### 1. `frontend/Dockerfile`
Multi-stage build for optimized Next.js production image:
- **Builder Stage**: Installs dependencies and builds the application
- **Runner Stage**: Minimal production image with built assets
- **Security**: Runs as non-root user
- **Size**: ~200MB (vs ~1GB without multi-stage)

### 2. `backend/Dockerfile`
Multi-stage build for FastAPI Python application:
- **Builder Stage**: Compiles Python dependencies
- **Production Stage**: Slim image with only runtime requirements
- **Health Check**: Built-in endpoint monitoring
- **Size**: ~150MB

### 3. `docker compose.yml`
Orchestrates both services:
- Automatic dependency management (frontend waits for backend)
- Environment variable injection
- Network configuration
- Volume mounting for service credentials
- Health checks for both services

### 4. `.dockerignore` Files
Excludes unnecessary files from Docker context:
- `node_modules/`, `__pycache__/`
- Environment files (`.env`)
- Build artifacts
- IDE configurations
- Reduces build context size by ~90%

### 5. `.env.example`
Template for all required environment variables with:
- Detailed comments explaining each variable
- Links to obtain API keys
- Firebase setup instructions
- Security notes

## Prerequisites

### Software Requirements
- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 2.0 or higher
- **Operating System**: macOS, Linux, or Windows with WSL2

### API Keys Required

| Service | Required? | Purpose |
|---------|-----------|---------|
| Google Maps API | Yes | Geocoding, places, directions |
| Google Maps Platform Weather API | Yes | Weather forecasts |
| Google Gemini AI | Yes | AI itinerary generation | 
| Firebase | Yes | Auth & database |
| Unsplash | Optional | Travel photos | 
| Google TTS | Optional | Podcast generation | 

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone https://github.com/ttphat-fitus/PocketAtlas
cd pocket-atlas
```

### 2. Environment Configuration

#### A. Create `.env` File

```bash
cp .env.example .env
```

#### B. Configure Google Maps API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable these APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
   - Directions API
   - Distance Matrix API
4. Create credentials → API Key
5. Restrict the key (recommended):
   - Application restrictions: HTTP referrers
   - API restrictions: Select the enabled APIs above
6. Copy the key to `.env`:
   ```env
   GOOGLE_MAPS_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

#### C. Weather API Configuration

Weather data is retrieved through Google Maps Platform Weather API, which uses the same API key as other Google Maps services configured in Step B above. No additional configuration is required beyond the Google Maps API key.

#### D. Configure Google Gemini AI

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Add to `.env`:
   ```env
   GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

#### E. Configure Firebase (Most Complex)

**Frontend Configuration (Public):**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing
3. Add a web app (click the `</>` icon)
4. Copy the configuration values to `.env`:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXX
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:xxxxx
   ```

**Backend Configuration (Private):**

1. In Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key" → Download JSON file
3. **Option A**: Convert to single-line JSON:
   ```bash
   cat firebase_key.json | jq -c
   ```
   Copy output to `.env`:
   ```env
   FIREBASE_CREDENTIALS='{"type":"service_account","project_id":"xxx",...}'
   ```

4. **Option B**: Place file in `backend/key/`:
   ```bash
   mkdir -p backend/key
   cp /path/to/firebase_key.json backend/key/firebase_key.json
   ```

**Enable Authentication:**

1. Firebase Console → Authentication → Sign-in method
2. Enable "Email/Password"
3. Enable "Google" (add OAuth 2.0 credentials)

**Create Firestore Database:**

1. Firebase Console → Firestore Database
2. Create database in production mode
3. Set initial rules (update later for security):
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

#### F. Optional: Unsplash API

1. Create account at [Unsplash Developers](https://unsplash.com/developers)
2. Create a new application
3. Add to `.env`:
   ```env
   UNSPLASH_ACCESS_KEY=your_unsplash_access_key
   ```

### 3. Build and Run with Docker

#### Single Command Launch

```bash
docker compose up --build
```

This command will:
1. Build both Docker images (5-10 minutes first time)
2. Create the network
3. Start both containers
4. Stream logs to your terminal

#### Detached Mode (Background)

```bash
docker compose up -d --build
```

View logs:
```bash
docker compose logs -f
```

### 4. Verify Installation

#### Check Container Status

```bash
docker compose ps
```

Expected output:
```
NAME                      STATUS              PORTS
pocketatlas-backend       Up (healthy)        0.0.0.0:8000->8000/tcp
pocketatlas-frontend      Up (healthy)        0.0.0.0:3000->3000/tcp
```

#### Test Endpoints

**Backend Health:**
```bash
curl http://localhost:8000/health
# Expected: {"status":"healthy","environment":"production"}
```

**Backend API Docs:**
Open http://localhost:8000/docs in your browser

**Frontend:**
Open http://localhost:3000 in your browser

### 5. Usage

1. Navigate to http://localhost:3000
2. Sign up with email or Google
3. Click "Plan a Trip"
4. Fill in your travel details
5. Let the AI generate your itinerary!

## Common Commands

### Start Services
```bash
docker compose up
```

### Stop Services
```bash
docker compose down
```

### Rebuild After Code Changes
```bash
docker compose up --build
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### Execute Commands in Container
```bash
# Backend shell
docker compose exec backend bash

# Frontend shell
docker compose exec frontend sh

# Run backend migrations (if needed)
docker compose exec backend python manage.py migrate
```

### Clean Everything (Reset)
```bash
# Stop and remove containers, networks, volumes
docker compose down -v

# Remove images
docker compose down --rmi all

# Clean Docker cache
docker system prune -a
```

## Troubleshooting

### Issue: Build Fails with "no space left on device"

**Solution:**
```bash
# Clean Docker system
docker system prune -a --volumes

# Increase Docker Desktop disk space
# Docker Desktop → Preferences → Resources → Disk image size
```

### Issue: Frontend can't connect to backend

**Symptoms:**
- Network errors in browser console
- "Failed to fetch" errors

**Solutions:**
1. Check backend is running: `docker compose logs backend`
2. Verify `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env`
3. Restart containers: `docker compose restart`
4. Check network: `docker network inspect pocketatlas_pocketatlas-network`

### Issue: Firebase Authentication Fails

**Symptoms:**
- "Auth domain not configured" error
- Can't sign in

**Solutions:**
1. Verify all `NEXT_PUBLIC_FIREBASE_*` variables in `.env`
2. Check Firebase Console → Authentication is enabled
3. Ensure authorized domains include `localhost`
4. Verify service account JSON is valid (backend)

### Issue: Maps Not Loading

**Symptoms:**
- Blank map areas
- "API key error" in console

**Solutions:**
1. Verify `GOOGLE_MAPS_API_KEY` in `.env`
2. Check Google Cloud Console → APIs are enabled
3. Verify API key restrictions allow your origin
4. Check billing is enabled (required even for free tier)

### Issue: AI Generation Fails

**Symptoms:**
- "Failed to generate itinerary" error
- Timeout errors

**Solutions:**
1. Verify `GEMINI_API_KEY` in `.env`
2. Check quota: [Google AI Studio](https://makersuite.google.com/)
3. Review backend logs: `docker compose logs backend | grep -i gemini`
4. Ensure internet connectivity from container

### Issue: Port Already in Use

**Symptoms:**
```
Error: bind: address already in use
```

**Solutions:**

**Option 1**: Stop conflicting service
```bash
# Find process using port 3000
lsof -i :3000
# Kill it
kill -9 <PID>
```

**Option 2**: Change ports in `docker compose.yml`
```yaml
frontend:
  ports:
    - "3001:3000"  # Host:Container
backend:
  ports:
    - "8001:8000"
```

Then update `.env`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8001
```

### Issue: Environment Variables Not Loading

**Symptoms:**
- API features not working
- "Undefined" errors in logs

**Solutions:**
1. Verify `.env` file exists in project root (not `.env.example`)
2. Check for spaces around `=`: `KEY=value` not `KEY = value`
3. Restart containers: `docker compose down && docker compose up`
4. Verify line endings (LF not CRLF): `dos2unix .env` (Linux/Mac)

## Production Deployment

### Build Production Images

```bash
# Build with production tags
docker compose -f docker compose.prod.yml build

# Push to registry
docker tag pocketatlas-frontend:latest yourregistry/pocketatlas-frontend:v1.0
docker tag pocketatlas-backend:latest yourregistry/pocketatlas-backend:v1.0
docker push yourregistry/pocketatlas-frontend:v1.0
docker push yourregistry/pocketatlas-backend:v1.0
```

### Environment Variables for Production

Update `.env` for production:
```env
ENVIRONMENT=production
FRONTEND_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### Security Considerations

1. **Never commit `.env` to version control**
2. **Use secrets management** (AWS Secrets Manager, Google Secret Manager)
3. **Enable HTTPS** (use nginx reverse proxy with Let's Encrypt)
4. **Restrict API keys** (domain restrictions, IP allowlisting)
5. **Update Firestore rules** (production-ready rules)
6. **Set up monitoring** (health checks, alerting)

## Performance Optimization

### Image Size Comparison

| Stage | Frontend | Backend |
|-------|----------|---------|
| Without multi-stage | ~1.2GB | ~800MB |
| With multi-stage | ~210MB | ~155MB |
| **Savings** | **82%** | **81%** |

### Build Cache

Docker caches layers. Order `Dockerfile` instructions from least to most frequently changing:

**Good:**
```dockerfile
COPY package*.json ./
RUN npm ci
COPY . .
```

**Bad:**
```dockerfile
COPY . .
RUN npm ci
```

### Development vs Production

Use different compose files:

**docker compose.dev.yml** (hot reload, source maps):
```yaml
frontend:
  command: npm run dev
  volumes:
    - ./frontend:/app
```

**docker compose.prod.yml** (optimized, no volumes):
```yaml
frontend:
  command: node server.js
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Test

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker images
        run: docker compose build
      
      - name: Run containers
        run: docker compose up -d
      
      - name: Wait for health checks
        run: |
          timeout 60 bash -c 'until curl -f http://localhost:8000/health; do sleep 2; done'
          timeout 60 bash -c 'until curl -f http://localhost:3000; do sleep 2; done'
      
      - name: Run tests
        run: docker compose exec -T backend pytest
```


