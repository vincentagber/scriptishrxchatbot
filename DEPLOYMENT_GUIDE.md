# ScriptishRx cPanel Deployment Guide

This guide details how to deploy the ScriptishRx monorepo (Next.js Frontend + Express Backend) to a cPanel environment using a single domain.

**Target Domain:** `scriptishrx.gigrad.org`

## Prerequisites
- Access to cPanel.
- "Setup Node.js App" feature available in cPanel.
- Database (PostgreSQL/Supabase) connection details.

## 1. Prepare the Deployment File
We have created a script to automatically build the frontend and package it with the backend.

1. Open your terminal in the project root.
2. Run the build script:
   ```bash
   sh build_for_cpanel.sh
   ```
3. This will create a file named **`scriptishrx-deploy.zip`** in the project root.

---

## 2. Upload to cPanel
1. Log in to your cPanel.
2. Open **File Manager**.
3. Navigate to the root folder for your domain (usually `public_html` or `scriptishrx.gigrad.org`).
4. **Upload** the `scriptishrx-deploy.zip` file.
5. **Extract** the zip file.
   - You should see folders like `src`, `public`, and files like `package.json`.

---

## 3. Configure Node.js Application
1. Go to the cPanel main menu and click **"Setup Node.js App"**.
2. Click **"Create Application"**.
3. Fill in the details:
   - **Node.js Version**: Select **18.x** or **20.x** (match your local version if known).
   - **Application Mode**: **Production**.
   - **Application Root**: The path where you extracted the files (e.g., `scriptishrx.gigrad.org` or `public_html`).
   - **Application URL**: `scriptishrx.gigrad.org`.
   - **Application Startup File**: `src/server.js` (this is critical!).
4. Click **Create**.

---

## 4. Install Dependencies
1. Once the app is created, scroll down to the "Detected Configuration" section (or similar).
2. Click the **"Run NPM Install"** button.
   - This will install all backend dependencies defined in `package.json`.

---

## 5. Configure Environment Variables
You need to set the environment variables for the application to work.

1. In the Node.js App settings page, look for **"Environment Variables"** (or create a `.env` file in the Application Root via File Manager).
2. Add the following variables (copy values from your local `.env`):

| Variable | Value / Description |
|----------|---------------------|
| `NODE_ENV` | `production` |
| `PORT` | (Leave empty or let cPanel invoke it, usually Passenger handles this) |
| `My_App_Port` | If cPanel asks for a specific port variable (rare), check docs. |
| `JWT_SECRET` | `ReplaceWithAStrongSecret` |
| `SUPABASE_URL` | Your Supabase URL |
| `SUPABASE_ANON_KEY` | Your Supabase Anon Key |
| `DATABASE_URL` | Your Connection String |
| `FRONTEND_URL` | `https://scriptishrx.gigrad.org` |
| `NEXT_PUBLIC_API_URL` | `https://scriptishrx.gigrad.org/api` (or empty if same domain) |

**Important:** If using a `.env` file, ensure it is in the same directory as `package.json`.

---

## 6. Restart the Application
1. Go back to the **Setup Node.js App** page.
2. Click **Restart Application**.

## 7. Verify Deployment
1. Visit `https://scriptishrx.gigrad.org`.
   - You should see the Landing Page (served from `public/index.html`).
2. Visit `https://scriptishrx.gigrad.org/api/health`.
   - You should see a JSON response: `{"status":"ok", ...}`.

---

## Troubleshooting
- **Frontend shows 404 (Loading...)**: Check if `backend/public` exists and contains `index.html`.
- **API Errors**: Check the `stderr.log` in cPanel File Manager (usually created in the app root) for crash logs.
- **Database Connection Error**: Verify `DATABASE_URL` allows connections from the cPanel IP (check Supabase "Network Restrictions" if enabled).
