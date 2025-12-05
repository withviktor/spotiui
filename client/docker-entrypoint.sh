#!/bin/sh

# Default to localhost if not set
API_URL=${API_URL:-http://localhost:3001}

echo "Injecting API_URL: $API_URL"

# Write config.js
echo "window.SPOTIUI_CONFIG = { API_URL: \"$API_URL\" };" > /usr/share/nginx/html/config.js

# Start Nginx
exec nginx -g "daemon off;"
