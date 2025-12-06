#!/bin/bash

# Configuration
# Set this to your Cloud API URL
API_URL=${1:-https://t48oogcowg4os04484oowgog.blushing-bug.bylinemark.com} 

echo "Setting up Kiosk Client..."
echo "Using API URL: $API_URL"

# Export for Docker Compose
export API_URL=$API_URL

# Run Client Container
docker-compose -f docker-compose.kiosk.yml up -d --build

echo "Client is running on http://localhost"

# Instructions for Kiosk Mode (Linux/Raspberry Pi)
echo "To launch in Kiosk mode manually:"
echo "chromium-browser --kiosk --noerrdialogs --disable-infobars --password-store=basic http://localhost"
