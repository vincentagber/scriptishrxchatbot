#!/bin/bash

# ScriptishRx cPanel Deployment Builder
# This script prepares the application for deployment to cPanel.

echo "🚀 Starting Deployment Build Process..."

# 1. Build Frontend
echo "📦 Building Frontend..."
cd frontend
# Ensure dependencies are installed (optional, uncomment if needed)
# npm install
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Frontend Build Successful"
else
    echo "❌ Frontend Build Failed"
    exit 1
fi

cd ..

# 2. Prepare Backend Directory
echo "📂 Preparing Backend & Merging..."
rm -rf backend/public
mkdir -p backend/public

# 3. Move Frontend Static Export to Backend Public
echo "🚚 Moving frontend/out to backend/public..."
cp -R frontend/out/* backend/public/

# 4. Create API Production Config
# We don't want to overwrite .env, but we can create a .env.production example
# echo "NODE_ENV=production" > backend/.env.production

# 5. Zip the Backend (Application Artifact)
echo "🤐 Zipping Application for Deployment..."
cd backend
rm -rf node_modules # Remove node_modules to keep zip small (cPanel will install them)
rm -f scriptishrx-deploy.zip
zip -r ../scriptishrx-deploy.zip . -x ".git/*" "node_modules/*" ".env"

cd ..

echo "========================================================"
echo "🎉 Build Complete!"
echo "✅ Deployment Archive: scriptishrx-deploy.zip"
echo "========================================================"
echo "NEXT STEPS:"
echo "1. Upload 'scriptishrx-deploy.zip' to your cPanel file manager (e.g., in public_html or a subdomain folder)."
echo "2. Follow the instructions in DEPLOYMENT_GUIDE.md to complete the setup."
