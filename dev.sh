#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status

# Builds the library and the embed script, then starts the demo app in ./demo
# against those builds, so what you try out is what people get when they install
# kanza. Run it again after every library change: the app uses dist, not the
# source. There are two pages: / is the React app, /embed.html is the script tag.

echo "🛠 Building..."
npm run build
npm run build:embed

echo "🚀 Starting the demo app..."
npx vite serve demo
