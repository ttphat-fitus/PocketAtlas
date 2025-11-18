# Pocket Atlas — AI Travel Planner

> Pocket Atlas is a small AI-powered travel itinerary generator. Give it a destination, dates and preferences; the app calls Gemini to generate a day-by-day plan and enriches places with Google Places details (addresses, photos, map links).

This repository contains a Next.js frontend and a FastAPI backend that orchestrates calls to Gemini and Google Places.

## Key features
- Generate multi-day, day-by-day itineraries
- Use Gemini (Generative AI) to draft realistic activities
- Enrich each place with Google Places (address, rating, photo, coordinates)
- Simple interactive UI to view and edit the generated plan

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
npm run dev
# open http://localhost:3000
```

