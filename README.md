# SpotiUI

A modern, kiosk-friendly Spotify player designed for TVs and displays. It features a centralized API for authentication and a sleek, glassmorphic React client.

![SpotiUI](https://via.placeholder.com/800x450?text=SpotiUI+Kiosk+Preview)

## Features

*   **Kiosk UI:** High contrast, large typography, and beautiful full-screen album art with dynamic color extraction.
*   **Centralized API:** Handles Spotify OAuth and token management securely using WebSockets.
*   **Real-time:** Live track progress and queue updates.
*   **QR Code Login:** Seamless authentication from mobile devices without typing credentials on the TV.
*   **Docker Ready:** Ready-to-go scripts for splitting deployment between a Cloud API and Local Kiosk client.

## Prerequisites

*   Node.js (v18+)
*   Docker & Docker Compose
*   [Spotify Developer Account](https://developer.spotify.com/dashboard) (Client ID & Secret)

## Quick Start (Development)

### 1. Configure API
1.  Navigate to the `api` directory:
    ```bash
    cd api
    ```
2.  Create a `.env` file based on the example:
    ```bash
    cp .env.example .env
    ```
3.  Fill in your Spotify Credentials in `.env`:
    ```env
    SPOTIFY_CLIENT_ID=your_client_id
    SPOTIFY_CLIENT_SECRET=your_client_secret
    SPOTIFY_REDIRECT_URI=http://localhost:3001/callback
    PORT=3001
    ```
    *Note: Ensure `http://localhost:3001/callback` is added to your Redirect URIs in the Spotify Dashboard.*

### 2. Run the Project
You can run the full stack using Docker Compose:

```bash
docker-compose up --build
```

Access the application:
*   **Client:** [http://localhost](http://localhost)
*   **API:** [http://localhost:3001](http://localhost:3001)

## Deployment Guide

This project is designed to be split: the **API** runs on a stable cloud server, and the **Client** runs on the display device (e.g., Raspberry Pi).

### 1. Backend (Cloud Server)
1.  Upload the `api` folder, `docker-compose.cloud.yml`, and `deploy-cloud.sh` to your server.
2.  Create your `.env` file with production credentials.
    *   *Important:* Update `SPOTIFY_REDIRECT_URI` to match your server's IP/Domain (e.g., `http://my-server.com:3001/callback`).
3.  Run the deployment script:
    ```bash
    chmod +x deploy-cloud.sh
    ./deploy-cloud.sh
    ```

### 2. Frontend (Kiosk Device)
1.  Upload the `client` folder, `docker-compose.kiosk.yml`, and `setup-kiosk.sh` to your Raspberry Pi/MicroPC.
2.  Run the setup script, pointing it to your Cloud API:
    ```bash
    chmod +x setup-kiosk.sh
    ./setup-kiosk.sh http://my-server.com:3001
    ```
3.  Launch the browser in Kiosk mode:
    ```bash
    chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost
    ```

## Architecture

*   **Client:** React + Vite + TypeScript. Connects via Socket.IO.
*   **API:** Express + Socket.IO + spotify-api.js. Handles auth state and polling.

## License

MIT
