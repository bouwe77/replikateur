#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status

# Builds the library and starts the demo app in ./demo against that build, so
# what you try out is what people get when they install kanza. Run it again
# after every library change: the app uses dist, not the source.

echo "🛠 Building..."
npm run build

echo "🚀 Starting the demo app..."
npx vite serve demo
