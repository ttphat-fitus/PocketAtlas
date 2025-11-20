# Pocket Atlas — AI Travel Planner

> Pocket Atlas is a small AI-powered travel itinerary generator. Give it a destination, dates and preferences; the app calls Gemini to generate a day-by-day plan and enriches places with TrackAsia geocoding API (addresses, coordinates, map links).

This repository contains a Next.js frontend and a FastAPI backend that orchestrates calls to Gemini and TrackAsia.

## Key features
- Generate multi-day, day-by-day itineraries
- Use Gemini (Generative AI) to draft realistic activities
- Enrich each place with TrackAsia API (address, coordinates, location types)
- Simple interactive UI to view and edit the generated plan
- Drag & drop to reorder activities with automatic time recalculation
- **Firebase Authentication**: Support for email/password login and anonymous users
- **Trip Storage**: Save trips to Firestore, accessible across devices
- **Multi-language**: English and Vietnamese interface

## Project structure (important files)
- `frontend/` — Next.js app (pages in `frontend/app`, styles in `frontend/app/globals.css`)
- `backend/` — FastAPI app (`backend/main.py` is the server)
- `backend/key/` — JSON files for API keys used by the backend

## Quick start (macOS / zsh)

Prerequisites
- Node (v18+ recommended)
- Python 3.10+ (virtualenv recommended)

Run backend

```bash
cd backend
# create & activate a venv (optional but recommended)
python -m venv .venv
source .venv/bin/activate
pip install -U pip
# install minimal deps used by the project
pip install fastapi uvicorn google-generativeai requests python-dotenv
# run the API server (reload enabled)
python -m uvicorn main:app --reload --port 8000
```

Run frontend

```bash
cd frontend
npm install

# Create .env.local with Firebase config (see .env.local.example)
# Add your Firebase credentials from Firebase Console

npm run dev
# open http://localhost:3000
```

## Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication (Email/Password, Anonymous)
3. Create a Firestore database
4. Get your web app config from Project Settings
5. Create `frontend/.env.local` with Firebase credentials
6. Download service account JSON to `backend/key/firebase_key.json`

## API Endpoints

- `POST /api/plan-trip` - Generate new trip (supports auth)
- `GET /api/my-trips` - Get user's saved trips (requires auth)
- `GET /api/trip/{trip_id}` - Get specific trip (requires auth)
- `DELETE /api/trip/{trip_id}` - Delete trip (requires auth)

