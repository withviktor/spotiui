#!/bin/bash

# SpotiUI Native Kiosk Launcher
# Usage: ./run-native-kiosk.sh [API_URL]

API_URL=${1:-http://localhost:3001}
PORT=3000

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 1. Environment Checks
echo "🔍 Checking environment..."

if ! command_exists node; then
    echo "❌ Error: Node.js is not installed. Please install Node.js v18+."
    exit 1
fi

BROWSER_CMD=""
if command_exists chromium-browser; then
    BROWSER_CMD="chromium-browser"
elif command_exists chromium; then
    BROWSER_CMD="chromium"
elif command_exists google-chrome; then
    BROWSER_CMD="google-chrome"
else
    echo "⚠️  Warning: No Chromium/Chrome browser found. The server will start, but Kiosk mode won't launch automatically."
fi

# 2. Build & Configure Client
echo "🚀 Preparing SpotiUI Client..."
echo "🔗 API URL: $API_URL"

cd client || exit 1

# Check for node_modules or specifically the serve binary
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/serve" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

if [ ! -d "dist" ]; then
    echo "🔨 Building project..."
    npm run build
fi

# Always update config in case API_URL changed
echo "⚙️  Injecting Configuration..."
echo "window.SPOTIUI_CONFIG = { API_URL: \"$API_URL\" };" > dist/config.js

# 3. Start Server
echo "🟢 Starting local server on port $PORT..."
# Prefer local binary to avoid npx cache issues
if [ -f "node_modules/.bin/serve" ]; then
    ./node_modules/.bin/serve -s dist -l $PORT &
else
    npx serve -s dist -l $PORT &
fi
SERVER_PID=$!

# Ensure we kill the server when this script exits
trap "kill $SERVER_PID" EXIT

# Wait a moment for server to start
echo "⏳ Waiting for server to initialize..."
sleep 3

# 4. Launch Kiosk
if [ -n "$BROWSER_CMD" ]; then
    echo "🖥️  Launching Kiosk Mode..."
    
    # Flags explanation:
    # --kiosk: Fullscreen, no bars
    # --noerrdialogs: Don't show "Chrome didn't shut down correctly"
    # --disable-infobars: Hide "Chrome is being controlled..."
    # --check-for-update-interval=31536000: Disable update checks
    
    "$BROWSER_CMD" \
        --kiosk \
        --noerrdialogs \
        --disable-infobars \
        --check-for-update-interval=31536000 \
        --disable-pinch \
        --overscroll-history-navigation=0 \
        "http://localhost:$PORT"
else
    echo "✅ Server running at http://localhost:$PORT"
    echo "Press Ctrl+C to stop."
    wait $SERVER_PID
fi
