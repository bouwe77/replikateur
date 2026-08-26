#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status

# Check argument
if [ -z "$1" ]; then
  echo "Error: Please provide a version bump type: major, minor, or patch"
  exit 1
fi

echo "🚀 Starting publish process..."

# 1. Install first, so the build cannot fail on a missing build tool halfway
#    through a release, after the version bump has already happened.
echo "📦 Installing dependencies..."
npm install

# 2. Bump version
echo "🔖 Bumping version ($1)..."
npm version "$1"

# 3. Build
echo "🛠 Building..."
npm run build

# 4. Publish
echo "🚀 Publishing to NPM..."
npm publish --access public

# 5. Push tags (Only happens if publish succeeds)
echo "pusher git tags..."
git push --follow-tags

echo "✅ Kanza published successfully!"