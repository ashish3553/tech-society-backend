To work on the project locally after deployment, you need to configure your environment to run both frontend and backend locally while preserving your production setup. Here's what to change:

## **Frontend Local Development Setup**

### **1. Update API Configuration**
**File: `client/src/api/api.js`**
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
```

**File: `client/.env.development` (create if doesn't exist)**
```env
VITE_API_URL=http://localhost:5000
```

**Keep production settings in `client/.env.production`:**
```env
VITE_API_URL=https://tech-society-backend.onrender.com
```

### **2. Start Frontend Locally**
```bash
cd client
npm install
npm run dev  # Runs on localhost:3000 or localhost:5173
```

## **Backend Local Development Setup**

### **1. Update CORS for Local Development**
**File: `server/index.js`**
```javascript
const corsOptions = {
  origin: [
    'https://practicearenauieth.vercel.app', // Production frontend
    'http://localhost:3000',                 // Local React dev server
    'http://localhost:5173',                 // Vite dev server
    'http://localhost:3001'                  // Alternative port
  ],
  credentials: true,
  // ... rest of config
};
```

### **2. Environment Variables for Local Backend**
**File: `server/.env.development`**
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/techsociety  # Local DB
# OR use production DB
MONGODB_URI=your-production-mongodb-uri

JWT_SECRET=your-jwt-secret
PISTON_URL=http://localhost:2000/api/v2  # Local Piston
CLIENT_URL=http://localhost:3000

# Email (can use production or test keys)
MAILJET_API_KEY=your-key
MAILJET_API_SECRET=your-secret
DEFAULT_FROM_EMAIL=noreply@localhost

# File upload (use production keys)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key  
CLOUDINARY_API_SECRET=your-secret
```

### **3. Start Piston API Locally**
```bash
# Start Docker Piston container
docker run -d \
  --name piston_api \
  -p 2000:2000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  ghcr.io/engineer-man/piston
```

### **4. Start Backend Locally**
```bash
cd server
npm install
npm run dev  # or npm start
```

## **Database Options**

### **Option 1: Use Production Database (Recommended)**
- Keep using your production MongoDB
- All existing data remains accessible
- No setup required

### **Option 2: Local Database**
```bash
# Install MongoDB locally
# Ubuntu/WSL
sudo apt install mongodb

# macOS
brew install mongodb/brew/mongodb-community

# Start local MongoDB
mongod --dbpath=/path/to/data/directory
```

## **Development Workflow**

### **Daily Development Setup**
```bash
# Terminal 1: Start Piston (if using code execution)
docker start piston_api

# Terminal 2: Start Backend
cd server
npm run dev

# Terminal 3: Start Frontend  
cd client
npm run dev

# Visit: http://localhost:3000 or http://localhost:5173
```

### **Environment Switching**
**Local Development:**
- Frontend: `npm run dev` (uses .env.development)
- Backend: `npm run dev` (uses local .env)

**Production Deploy:**
- Frontend: Auto-deploys to Vercel (uses .env.production)
- Backend: Deploy to Render (uses production env vars)

## **Git Workflow for Development**

```bash
# Create development branch
git checkout -b feature/new-development

# Make changes locally using localhost URLs

# Test locally
# Frontend: http://localhost:3000
# Backend: http://localhost:5000

# When ready to deploy
git checkout main
git merge feature/new-development
git push origin main  # Auto-deploys to production
```

## **Key Points**

1. **Environment Files**: Use different .env files for development vs production
2. **CORS**: Make sure localhost is allowed in backend CORS
3. **Database**: Decide whether to use local or production database
4. **Piston**: Run Docker container locally for code execution
5. **No Code Changes**: Just environment configuration changes

This setup lets you develop locally while keeping production deployments intact. The environment files automatically handle the URL switching.

