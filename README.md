# 🌍 Pocket Atlas

<div align="center">

**Your Ultimate AI Travel Companion**

*Transform your travel dreams into perfectly planned adventures in seconds*

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat&logo=docker)](https://www.docker.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Enabled-FFCA28?style=flat&logo=firebase)](https://firebase.google.com/)

</div>

---

## The Elevator Pitch

Imagine having a **professional travel consultant in your pocket** that works 24/7, knows every destination like a local, and creates personalized itineraries tailored to your exact preferences and budget—all in under a minute.

**Pocket Atlas** is that companion. Powered by cutting-edge AI, it handles everything from day-by-day planning to packing lists, weather forecasts, and interactive maps. Whether you're planning a weekend getaway or a week-long adventure, simply tell us where you want to go, and we'll craft the perfect journey.

**No more hours of research. No more spreadsheet juggling. Just pure travel excitement.**

---

## Why You'll Love It

### **AI That Actually Gets You**
Forget generic itineraries. Our AI-powered engine creates trips that match YOUR style:
- **Budget-Conscious or Luxury Lover?** Choose from low, medium, or high budget tiers with real cost estimates
- **Adventure Junkie or Relaxation Seeker?** Set your activity intensity from chill to thrilling
- **Solo, Couple, Family, or Squad?** We optimize for your travel group

### **Interactive Maps That Make Sense**
- See your entire trip visualized on beautiful interactive maps
- Get turn-by-turn directions between every activity
- Explore each location with photos, ratings, and real reviews
- One tap to open navigation in Google Maps

### **Weather-Smart Planning**
- 3-day weather forecasts integrated into your itinerary
- Automatic packing suggestions based on climate
- Activity recommendations that adapt to weather conditions
- Never get caught in the rain unprepared again

### **Gamification That Rewards Exploration**
- Earn badges and achievements as you plan and travel
- Collect points for creating trips, sharing experiences, and engaging with the community
- Unlock rewards and climb the traveler ranks
- Track your travel stats and see your journey evolve

### **Community-Powered Inspiration**
- Browse thousands of itineraries shared by real travelers
- Discover hidden gems through community ratings and reviews
- Share your own adventures to inspire others
- Search trips by destination, budget, duration, or vibe

### **Personalization Like Never Before**
- Drag-and-drop to reorder activities in seconds
- Edit times, costs, and descriptions on the fly
- Export your plan to Google Calendar or Apple Calendar
- Generate audio podcasts of your itinerary (hands-free trip review!)

### **Your Data, Your Rules**
- Sign in with Google or email (or browse as a guest)
- Cloud-synced trips accessible from any device
- Choose what to keep private and what to share publicly
- Enterprise-grade security with Firebase

---

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:
- **Docker** (version 20.10+): [Install Docker](https://docs.docker.com/get-docker/)
- **Docker Compose** (version 2.0+): Usually included with Docker Desktop

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/pocket-atlas.git
cd pocket-atlas
```

### Step 2: Configure API Keys

Pocket Atlas requires several API keys to function. Don't worry—most have generous free tiers!

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Open `.env` in your favorite editor and fill in the required keys:**

   | Service | Why We Need It | Get Your Key |
   |---------|----------------|--------------|
   | **Google Maps API** | Location search, maps, directions, weather forecasts | [Get Key](https://console.cloud.google.com/apis/credentials) |
   | **Google Gemini AI** | AI-powered itinerary generation | [Get Key](https://makersuite.google.com/app/apikey) |
   | **Firebase** | User authentication & data storage | [Setup Guide](https://firebase.google.com/docs/web/setup) |
   | **Unsplash** | Beautiful travel photos | [Get Key](https://unsplash.com/developers) |

3. **Firebase Setup** (Most Important!)

   Firebase requires two sets of credentials:
   
   **Frontend (Public):** Get from Firebase Console > Project Settings > Your Web App
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

   **Backend (Private):** Download your service account JSON from Firebase Console > Project Settings > Service Accounts > Generate New Private Key
   
   Then either:
   - Convert to single-line JSON and paste in `.env`:
     ```bash
     cat firebase_key.json | jq -c
     ```
     Copy the output to `FIREBASE_CREDENTIALS` in `.env`
   
   - OR place the `firebase_key.json` file in `backend/key/` directory

### Step 3: Launch with Docker

Run this single command to build and start the entire application:

```bash
docker-compose up --build
```

**What's happening?**
- Building optimized Docker images for frontend and backend
- Installing all dependencies automatically
- Starting both services with proper networking
- Setting up health checks

**First-time build:** May take 5-10 minutes (grab a coffee ☕)  
**Subsequent starts:** Just a few seconds!

### Step 4: Access the Application

Once you see `✓ Ready` in your terminal:

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs

### Step 5: Start Planning!

1. Sign up or sign in with Google
2. Click "Plan a Trip"
3. Fill in your destination, dates, budget, and preferences
4. Watch the AI magic happen
5. Customize, save, and share your perfect itinerary!

---

## Development Mode

Want to develop locally without Docker?

<details>
<summary><b>Click to expand development setup</b></summary>

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Access at http://localhost:3000

</details>

---

## Tech Stack

<div align="center">

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS |
| **Backend** | FastAPI, Python 3.11, Uvicorn |
| **Database** | Firebase Firestore (NoSQL) |
| **Authentication** | Firebase Auth (Email, Google OAuth) |
| **AI Engine** | Google Gemini 2.5 Pro|
| **Maps, Geo & Weather** | Google Maps Platform APIs |
| **Deployment** | Docker, Docker Compose |

</div>

---

<!-- ## Screenshots

> *(Add your screenshots here)*

| Feature | Preview |
|---------|---------|
| **AI Trip Planning** | ![Trip Planning](https://via.placeholder.com/600x300?text=Add+Your+Screenshot) |
| **Interactive Maps** | ![Maps](https://via.placeholder.com/600x300?text=Add+Your+Screenshot) |
| **Community Discovery** | ![Explore](https://via.placeholder.com/600x300?text=Add+Your+Screenshot) |
| **Gamification Dashboard** | ![Profile](https://via.placeholder.com/600x300?text=Add+Your+Screenshot) |

--- -->

## Project Structure

```
pocket-atlas/
├── frontend/              # Next.js application
│   ├── app/              # App router pages & API routes
│   ├── components/       # Reusable React components
│   ├── contexts/         # Auth & Language contexts
│   └── lib/              # Utilities & configurations
├── backend/              # FastAPI application
│   ├── routers/          # API endpoints
│   ├── services/         # Business logic (AI, Maps, Weather)
│   ├── models/           # Pydantic schemas
│   ├── firebase/         # Authentication middleware
│   └── core/             # Configuration & database
└── docker-compose.yml    # Multi-container orchestration
```

---
<!-- ## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

--- -->

## Troubleshooting

<details>
<summary><b>Docker build fails</b></summary>

- Ensure Docker has at least 4GB RAM allocated
- Clear Docker cache: `docker system prune -a`
- Rebuild: `docker-compose up --build --force-recreate`

</details>

<details>
<summary><b>API keys not working</b></summary>

- Verify all keys are on a single line in `.env` (no line breaks)
- Check for extra spaces before/after the `=` sign
- Ensure Firebase credentials are valid JSON
- Restart containers: `docker-compose restart`

</details>

<details>
<summary><b>Frontend can't connect to backend</b></summary>

- Verify `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env`
- Check backend is running: `docker-compose logs backend`
- Ensure both containers are on the same network

</details>

---

<div align="center">

**Made with ❤️ by TDTT team, for travelers**

*Start your next adventure with Pocket Atlas*

</div>