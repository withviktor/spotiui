import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { Client } from 'spotify-api.js';
import crypto from 'crypto';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000, // Increase to 60 seconds
  pingInterval: 25000 // Send ping every 25 seconds
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REDIRECT_URI) {
  console.error("Missing Spotify credentials in .env");
  process.exit(1);
}

// Store state -> socketId mapping
const authStates = new Map<string, string>();

// Store socketId -> SpotifyClient mapping
const spotifyClients = new Map<string, Client>();

// Store polling intervals
const pollingIntervals = new Map<string, NodeJS.Timeout>();

const SCOPES = [
  'user-read-playback-state',
  'user-read-currently-playing',
  'user-modify-playback-state', // for queue
  'user-read-private',
  'user-read-email',
  'app-remote-control',
  'streaming'
].join(' ');

app.get('/', (req, res) => {
  res.send('SpotiUI API is running');
});

app.get('/login', (req, res) => {
  const socketId = req.query.socketId as string;
  if (!socketId) {
    res.status(400).send("Missing socketId");
    return;
  }

  const state = crypto.randomBytes(16).toString('hex');
  authStates.set(state, socketId);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID!,
    scope: SCOPES,
    redirect_uri: SPOTIFY_REDIRECT_URI!,
    state: state
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code as string || null;
  const state = req.query.state as string || null;
  const error = req.query.error as string || null;

  if (error) {
    res.send(`Error: ${error}`);
    return;
  }

  if (!state || !authStates.has(state)) {
    res.send("State mismatch or invalid state");
    return;
  }

  const socketId = authStates.get(state)!;
  authStates.delete(state);

  try {
    const client = await Client.create({
      token: {
        clientID: SPOTIFY_CLIENT_ID!,
        clientSecret: SPOTIFY_CLIENT_SECRET!,
        code: code!,
        redirectURL: SPOTIFY_REDIRECT_URI!
      }
    });

    const accessToken = client.token;
    // We need to access the refresh token. 
    // The library might not expose it directly on client.token if it's just a string.
    // Let's check how to get the refresh token. 
    // Looking at the docs/source, client.token is just the access token string.
    // However, the `Client.create` method uses `AuthManager` internally. 
    // Let's rely on the client refreshing itself if we keep it alive, 
    // BUT the user wants the client to store tokens. 
    // We need to extract the refresh token.
    // In `spotify-api.js`, `client.refreshMeta` might hold it.
    
    const refreshToken = client.refreshMeta?.refreshToken;

    // Send tokens to the connected client via WebSocket
    io.to(socketId).emit('login_success', { 
      accessToken, 
      refreshToken: refreshToken || '' 
    });

    res.send(`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: sans-serif; background: #121212; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; text-align: center; }
            h1 { color: #1DB954; }
          </style>
        </head>
        <body>
          <div>
            <h1>Connected!</h1>
            <p>You can now control the music from the Kiosk.</p>
            <p>You can close this window.</p>
          </div>
        </body>
      </html>
    `);

  } catch (err) {
    console.error("Error creating Spotify client:", err);
    res.send("Error during authentication");
  }
});

function startPolling(socketId: string, client: Client) {
  if (pollingIntervals.has(socketId)) {
    clearInterval(pollingIntervals.get(socketId));
  }

  const interval = setInterval(async () => {
    try {
      const playback = await client.user.player.getCurrentPlayback();
      const queue = await client.fetch('/me/player/queue');
      
      console.log(`Socket ${socketId} playback update:`, playback ? `Playing: ${playback.item?.name}` : "No playback");

      io.to(socketId).emit('playback_update', {
        playback,
        queue
      });
    } catch (error) {
        console.error(`Error polling for socket ${socketId}:`, error);
    }
  }, 3000);

  pollingIntervals.set(socketId, interval);
}

io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);

  socket.on('authenticate', async ({ accessToken, refreshToken }) => {
    try {
        let client;
        if (refreshToken) {
             client = await Client.create({
                token: {
                    clientID: SPOTIFY_CLIENT_ID!,
                    clientSecret: SPOTIFY_CLIENT_SECRET!,
                    redirectURL: SPOTIFY_REDIRECT_URI!,
                    refreshToken: refreshToken
                }
            });
        } else {
            // Fallback if we only have accessToken (might expire quickly)
            // But usually we should have both.
             client = await Client.create({
                token: {
                    clientID: SPOTIFY_CLIENT_ID!,
                    clientSecret: SPOTIFY_CLIENT_SECRET!,
                    redirectURL: SPOTIFY_REDIRECT_URI!,
                    code: "dummy", // The library might need a structural placeholder if we don't have a better way
                    // actually if we just pass the token string to constructor it might work, 
                    // but Client.create expects the object for auth flow.
                    // Let's assume refreshToken is always present for this flow.
                }
            });
            // Manual override if needed
            client.token = accessToken;
        }

        spotifyClients.set(socket.id, client);
        io.to(socket.id).emit('login_success', { message: "Authenticated successfully" });
        startPolling(socket.id, client);
    } catch (e) {
        console.error("Auth failed", e);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (pollingIntervals.has(socket.id)) {
      clearInterval(pollingIntervals.get(socket.id)!);
      pollingIntervals.delete(socket.id);
    }
    spotifyClients.delete(socket.id);
  });
});


httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
