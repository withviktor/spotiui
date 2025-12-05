#!/bin/bash

# Configuration
# Set this to your Cloud API URL
API_URL=${1:-http://localhost:3001} 

echo "Setting up Kiosk Client..."
echo "Using API URL: $API_URL"

# Export for Docker Compose
export API_URL=$API_URL

# Run Client Container
docker-compose -f docker-compose.kiosk.yml up -d --build

echo "Client is running on http://localhost"

# Instructions for Kiosk Mode (Linux/Raspberry Pi)
echo "To launch in Kiosk mode manually:"
echo "chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost"
