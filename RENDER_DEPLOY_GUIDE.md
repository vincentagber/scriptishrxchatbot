# ScriptishRx Render Deployment Guide

This guide details how to deploy the ScriptishRx monorepo to Render as a **Web Service**.

## prerequisites
- A GitHub repository containing this code.
- A [Render](https://render.com) account.

## Configuration Steps

1. **Log in to Render** and click **New +** -> **Web Service**.
2. **Connect your GitHub repository**.
3. **Configure the Service** with the following settings:

| Setting | Value |
| :--- | :--- |
| **Name** | `scriptishrx` (or your choice) |
| **Region** | Choose one close to your users (e.g., Frankfurt for EU) |
| **Branch** | `main` |
| **Root Directory** | `.` (Leave empty) |
| **Runtime** | **Node** |
| **Build Command** | `npm run build:render` |
| **Start Command** | `npm start` |

4. **Environment Variables**:
   Scroll down to the "Environment Variables" section and add the following keys from your `.env` file:

   - `NODE_ENV`: `production`
   - `JWT_SECRET`: (Your secret)
   - `DATABASE_URL`: (Your Supabase connection string)
   - `SUPABASE_URL`: (Your Supabase URL)
   - `SUPABASE_ANON_KEY`: (Your Supabase Anon Key)
   - `VOICECAKE_API_KEY`: (Your VoiceCake Key)
   - `OPENAI_API_KEY`: (Your OpenAI Key)
   - `NEXT_PUBLIC_API_URL`: `https://your-render-app-name.onrender.com` (Update this after you get the URL)
   - `FRONTEND_URL`: `https://your-render-app-name.onrender.com`

5. **Deploy**:
   Click **Create Web Service**.

## How it Works
- The `render-build.sh` script installs dependencies, builds the Next.js frontend into a static site, and moves it to `backend/public`.
- The `npm start` command runs the Express backend.
- The Express backend serves the API at `/api/*` and serving the static frontend files for all other routes.
