# Pocket Atlas — AI Travel Planner 🗺️

> An intelligent AI-powered travel itinerary generator that creates personalized day-by-day trip plans. Simply provide your destination, travel dates, preferences, and budget—the app leverages Google Gemini AI to generate comprehensive itineraries and enriches locations with TrackAsia geocoding API (addresses, coordinates, ratings, photos, and map links).

This repository contains a Next.js 16 frontend with TypeScript and a FastAPI backend that orchestrates AI-powered trip generation with real-world location data.

## ✨ Key Features

### Trip Planning
- **AI-Powered Generation**: Multi-day, day-by-day itineraries using Google Gemini AI
- **Smart Location Enrichment**: Automatic place details via TrackAsia API (addresses, coordinates, ratings, photos)
- **Weather Forecasting**: Integrated weather predictions for your trip dates
- **Budget Customization**: Low, medium, or high budget options with cost estimates
- **Activity Level**: Tailor trips based on your preferred activity intensity (low/medium/high)
- **Flexible Duration**: Plan trips from 1 to 14+ days

### User Experience
- **Interactive UI**: Modern, responsive design with DaisyUI and Tailwind CSS
- **Drag & Drop**: Reorder activities within each day seamlessly
- **Real-time Editing**: Modify and save changes to your itinerary
- **Star Ratings**: Rate your completed trips
- **Multi-language**: Full support for English and Vietnamese

### Authentication & Storage
- **Firebase Authentication**: 
  - Email/Password login
  - Anonymous users
  - Google OAuth integration
- **Cloud Storage**: All trips saved to Firestore, accessible across devices
- **Trip Management**: View, edit, delete, and organize your saved trips
- **Public/Private**: Toggle trip visibility for sharing

### Advanced Features
- **Trip Catalog**: Browse and discover trips shared by other users
- **Search & Filter**: Find trips by destination, budget, duration, or activity level
- **Calendar Export**: Export trips to Google Calendar or Apple Calendar (.ics)
- **Map Integration**: Direct links to Google Maps for each location
- **Photo Gallery**: Visual previews of destinations and activities
- **Travel Blog**: Tips, guides, and inspiration for your adventures

## 📁 Project Structure

```
.
├── frontend/                 # Next.js 16 application (React 19)
│   ├── app/                  # App router pages
│   │   ├── page.tsx          # Home page
│   │   ├── plan/             # Trip planning interface
│   │   ├── trips/            # My trips (saved itineraries)
│   │   ├── trip/[tripId]/    # Individual trip details
│   │   ├── explore/          # Public trip catalog
│   │   ├── blog/             # Travel blog
│   │   ├── auth/             # Authentication pages
│   │   └── api/              # API routes
│   ├── components/           # React components
│   ├── contexts/             # React contexts (Auth, Language)
│   ├── lib/                  # Utilities and helpers
│   └── public/               # Static assets
│
├── backend/                  # FastAPI application
│   ├── main.py               # Main API server
│   ├── firebase_config.py    # Firebase Admin SDK configuration
│   ├── auth_middleware.py    # Authentication middleware
│   ├── requirements.txt      # Python dependencies
│   └── key/                  # API keys (create this directory)
│       ├── chatbot_key.json  # Gemini API key
│       ├── ocr_key.json      # TrackAsia API key
│       ├── speech_key.json   # Speech API key
│       └── firebase_key.json # Firebase service account
│
└── README.md                 # This file
```

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v18+ (v20 recommended)
- **Python**: 3.10+ (3.13 recommended)
- **Firebase Project**: Create at [Firebase Console](https://console.firebase.google.com)
- **API Keys**:
  - Google Gemini API key
  - TrackAsia API key (optional, for location enrichment)

### Backend Setup

1. **Navigate to backend directory**
```bash
cd backend
```

2. **Create and activate virtual environment** (recommended)
```bash
# Using venv
python -m venv .venv
source .venv/bin/activate  # On macOS/Linux
# or
.venv\Scripts\activate  # On Windows

# Or using conda
conda create -n pocketatlas python=3.13
conda activate pocketatlas
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Configure API keys**

Create `backend/key/` directory and add the following JSON files:

**chatbot_key.json** (Gemini API):
```json
{
  "api_key": "your-gemini-api-key-here"
}
```

**ocr_key.json** (TrackAsia API):
```json
{
  "api_key": "your-trackasia-api-key-here"
}
```

**firebase_key.json** (Firebase Service Account):
- Download from Firebase Console → Project Settings → Service Accounts
- Click "Generate new private key"

5. **Run the backend server**
```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory**
```bash
cd frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure Firebase**

Create `.env.local` in the frontend directory:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

Get these values from Firebase Console → Project Settings → General → Your apps → SDK setup and configuration

4. **Run the development server**
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Firebase Setup

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Click "Add project"
   - Follow the setup wizard

2. **Enable Authentication**
   - Navigate to Authentication → Sign-in method
   - Enable Email/Password
   - Enable Anonymous
   - (Optional) Enable Google Sign-In

3. **Create Firestore Database**
   - Navigate to Firestore Database
   - Click "Create database"
   - Choose "Start in production mode"
   - Select your region

4. **Set up Firestore Security Rules**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trips/{tripId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == resource.data.user_id;
      allow delete: if request.auth != null && request.auth.uid == resource.data.user_id;
    }
    
    match /public_trips/{tripId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

5. **Get Web App Credentials**
   - Project Settings → General → Your apps
   - Click web icon (</>)
   - Register app and copy config to `.env.local`

6. **Download Service Account Key**
   - Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save as `backend/key/firebase_key.json`

## 📡 API Endpoints

### Trip Planning
- `POST /api/plan-trip` - Generate new AI trip itinerary (supports auth)
- `POST /api/plan-trip-stream` - Stream trip generation (real-time updates)

### Trip Management
- `GET /api/my-trips` - Get all user's saved trips (requires auth)
- `GET /api/trip/{trip_id}` - Get specific trip details (requires auth)
- `PUT /api/trip/{trip_id}` - Update trip details (requires auth)
- `PUT /api/trip/{trip_id}/rating` - Update trip rating (requires auth)
- `POST /api/trip/{trip_id}/toggle-public` - Toggle trip public/private (requires auth)
- `DELETE /api/trip/{trip_id}` - Delete trip (requires auth)

### Public Catalog
- `GET /api/public-trips` - Get all public trips (no auth)
- `GET /api/public-trips/{trip_id}` - Get specific public trip (no auth)

### Health Check
- `GET /` - API health check

## 🛠️ Technologies Used

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4 + DaisyUI 5
- **Authentication**: Firebase Auth
- **Database**: Firestore
- **Drag & Drop**: @dnd-kit
- **Markdown**: react-markdown

### Backend
- **Framework**: FastAPI 0.115+
- **Language**: Python 3.10+
- **AI**: Google Generative AI (Gemini)
- **Authentication**: Firebase Admin SDK
- **HTTP Client**: Requests
- **ASGI Server**: Uvicorn

## 🎨 Features in Detail

### Trip Generation Flow
1. User enters destination, dates, budget, and preferences
2. Backend calls Gemini AI with structured prompt
3. AI generates day-by-day itinerary with activities
4. Backend enriches each location with TrackAsia API
5. Frontend displays interactive itinerary with photos and maps
6. User can save, edit, rate, and share the trip

### Data Structure
Each trip contains:
- **Metadata**: Destination, duration, budget, activity level, start date
- **Overview**: AI-generated trip summary
- **Daily Activities**: Time-based activities with place details
- **Packing List**: Smart recommendations based on destination and season
- **Travel Tips**: Localized advice and insights
- **Weather Forecast**: Daily weather predictions
- **Cost Estimate**: Budget breakdown by day

## 🔒 Security Considerations

- API keys stored in separate JSON files (not in git)
- Firebase Admin SDK for secure backend authentication
- Firestore security rules for data access control
- CORS configured for production domains
- Anonymous users have limited access
- Token validation on protected endpoints

## 🌐 Environment Variables

### Backend
No `.env` file needed - all config in JSON files under `backend/key/`

### Frontend (`.env.local`)
```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## 📝 Development

### Run in Development Mode
```bash
# Backend (with auto-reload)
cd backend
uvicorn main:app --reload

# Frontend (with hot-reload)
cd frontend
npm run dev
```

### Build for Production
```bash
# Frontend
cd frontend
npm run build
npm start

# Backend
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is for educational purposes. Please respect API usage limits and terms of service for Gemini AI and TrackAsia.

## 👥 Authors

- **HCMUS Team** - Travel Technology Course Final Project

## 🙏 Acknowledgments

- Google Gemini AI for trip generation
- TrackAsia for location data and geocoding
- Firebase for authentication and storage
- Next.js and FastAPI communities

