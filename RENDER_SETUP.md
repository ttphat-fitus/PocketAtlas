# Render Deployment Setup Guide

## 🔴 **CRITICAL: Firebase Credentials Not Loaded**

The error "The default Firebase app does not exist" means the Firebase credentials are missing on Render.

### **Step 1: Upload Firebase Secret File to Render**

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select your **PocketAtlas** service
3. Click **Settings** → **Environment**
4. Look for **Secret Files** section (or scroll down)
5. Click **Add Secret File**
6. Fill in:
   - **Filename**: `firebase_key.json`
   - **Content**: Copy the ENTIRE contents from `backend/key/firebase_key.json`
   - Click Save

### **Step 2: Set Environment Variable in Render**

1. Still in **Settings** → **Environment** → **Environment Variables**
2. Add this variable:
   - **Key**: `FIREBASE_KEY_PATH`
   - **Value**: `/etc/secret_files/firebase_key.json`
3. Click Save

### **Step 3: Redeploy the Service**

1. Go to **Deployments** tab
2. Click the **Manual Deploy** button (or wait for auto-deploy)
3. Watch the logs to confirm Firebase initializes properly

### **Step 4: Verify It Works**

After redeploy, check the Render logs. You should see:
```
✓ Firebase key found at: /etc/secret_files/firebase_key.json
✓ Firebase initialized successfully
```

NOT:
```
⚠ Firebase key not found. Some features may not work.
```

---

## Alternative: Use FIREBASE_CREDENTIALS Env Var

If you don't want to use Secret Files, you can use an environment variable instead:

1. Open `backend/key/firebase_key.json`
2. Copy the ENTIRE JSON content
3. In Render Environment Variables, add:
   - **Key**: `FIREBASE_CREDENTIALS`
   - **Value**: [Paste the entire JSON on ONE line]
4. Redeploy

---

## 🆘 **If Still Not Working**

Check Render logs for these messages:
- `✓ Firebase key found at:` - Good sign
- `✗ Error parsing FIREBASE_CREDENTIALS:` - JSON format issue
- `⚠ Firebase key not found.` - File/env var not set correctly
