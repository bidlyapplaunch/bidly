# Fix for 503 Error - Admin Frontend Not Found

## Problem
The backend is trying to serve the admin frontend from `../auction-admin/dist`, but this folder doesn't exist in the Render deployment, causing a 503 error.

## Solution

Update your **Render backend service build command** to build the admin frontend first:

### For Render Build Command:

```bash
cd auction-admin && npm install && npm run build && cd ../auction-backend && npm install && npm start
```

### Or as separate steps:

**Build Command:**
```bash
cd auction-admin && npm install && npm run build
```

**Start Command:**
```bash
cd ../auction-backend && npm install && npm start
```

### Alternative: Update Root Directory

If you want to deploy from the root:

1. Set **Root Directory** in Render to: `auction-backend` (or leave blank)
2. Update **Build Command** to:
   ```bash
   cd ../auction-admin && npm install && npm run build
   ```
3. Update **Start Command** to:
   ```bash
   npm start
   ```

## What This Does

1. **Builds the admin frontend** - Creates `auction-admin/dist` folder with all the React app files
2. **Starts the backend** - The backend can now serve the admin files from `../auction-admin/dist`

## Verification

After deployment, check the backend logs. You should see:
```
📁 Serving admin frontend from: /path/to/auction-admin/dist
```

If you still see 503 errors, check:
- The `auction-admin/dist` folder exists
- The `index.html` file is in `auction-admin/dist/index.html`
- The build completed successfully (check Render build logs)

## Note

The backend package.json has been updated with a `prestart` script that automatically builds the admin frontend before starting. However, Render needs Node.js to build, so you still need to ensure the build command includes the admin build step.

