#!/bin/bash

echo "🚀 Building app..."
npm run build

echo "📱 Syncing Capacitor..."
npx cap sync android

echo "📦 Pushing to GitHub..."
git add .
git commit -m "Auto deploy update"
git push

echo "✅ Done!"
