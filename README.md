# Amex India Points Tracker

Track your American Express Charge Metal and Platinum Travel credit card rewards points.

## Features

- Track transactions for both Amex Charge Metal and Platinum Travel cards
- Automatic points calculation based on category and card type
- Milestone tracking for Platinum Travel (15K bonus at ₹1.9L spend)
- 3X points multiplier for international transactions on Charge Metal
- Cloud sync with Firebase (sign in with Google)
- Offline support with localStorage fallback
- Export/Import transaction data as JSON
- Category-wise spending breakdown

## Points Structure

| Card | Base Rate | International | No Points On |
|------|-----------|---------------|--------------|
| Charge Metal | 1 pt / ₹40 | 3X multiplier | Fuel, Insurance, Utilities |
| Platinum Travel | 1 pt / ₹50 | 1X (no bonus) | Fuel, Insurance, Utilities |

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Firebase (Required for Cloud Sync)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (e.g., "amex-points-tracker")
3. Enable Authentication:
   - Go to Authentication → Sign-in providers
   - Enable Google sign-in
4. Create Firestore Database:
   - Go to Firestore Database → Create database
   - Start in test mode (we'll add security rules)
5. Register a Web App:
   - Go to Project Settings → Your apps → Add app → Web
   - Copy the Firebase config

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Fill in your Firebase config values:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### 4. Set Up Firestore Security Rules

In Firebase Console → Firestore → Rules, add:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/transactions/{transactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 5. Run Development Server

```bash
npm run dev
```

The app will open at http://localhost:3000

## Deployment to Netlify

### 1. Push to GitHub

```bash
# Initialize git repo (if not already)
git init

# Add files
git add .

# Commit
git commit -m "Initial commit"

# Create GitHub repo and push
gh repo create amex-points-tracker --public --source=. --push
```

### 2. Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize and deploy
netlify init
```

When prompted:
- Build command: `npm run build`
- Publish directory: `dist`

### 3. Add Environment Variables in Netlify

Go to Netlify Dashboard → Site settings → Environment variables

Add all your Firebase config variables:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### 4. Update Firebase Auth Domain

In Firebase Console → Authentication → Settings → Authorized domains:
Add your Netlify domain (e.g., `your-site.netlify.app`)

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build locally
```

## Offline Mode

The app works without Firebase configuration using localStorage only. Without Firebase:
- No sign-in required
- Data stored locally in browser
- No cross-device sync

## Data Structure

Transactions are stored with this structure:

```javascript
{
  id: "unique-id",
  card: "metal" | "travel",
  amount: 1500,
  category: "dining",
  date: "2024-01-15",
  description: "Restaurant XYZ",
  points: 37,
  createdAt: timestamp
}
```

## Categories

- Dining
- Travel
- Shopping
- Groceries
- Entertainment
- International (3X on Metal)
- Fuel (No Points)
- Insurance (No Points)
- Utilities (No Points)
- Other

## Tech Stack

- Vite (build tool)
- Firebase (auth + Firestore)
- Vanilla JavaScript (no framework)
- CSS (custom styling)

## License

MIT
