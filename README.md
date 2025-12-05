# Pocket Atlas

> An intelligent AI-powered travel itinerary generator that creates personalized day-by-day trip plans. Simply provide your destination, travel dates, preferences, and budget—the app leverages Google Gemini AI to generate comprehensive itineraries and enriches locations with TrackAsia geocoding API (addresses, coordinates, ratings, photos, and map links).

## Key Features

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

Create `backend/key/` directory and add the API JSON files

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

## Technologies Used

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

## Features in Detail

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

## Development

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