#!/bin/bash

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | xargs)
fi

echo "Deploying Backend to Cloud..."
docker-compose -f docker-compose.cloud.yml up -d --build

echo "Backend is running at http://localhost:3001 (or your cloud IP)"
