import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { FastAverageColor } from 'fast-average-color';
import { QRCodeSVG } from 'qrcode.react';
import './App.css';

const getApiUrl = () => {
  if (window.SPOTIUI_CONFIG && window.SPOTIUI_CONFIG.API_URL) {
    return window.SPOTIUI_CONFIG.API_URL;
  }
  return 'https://t48oogcowg4os04484oowgog.blushing-bug.bylinemark.com';
};

const socket: Socket = io(getApiUrl());

interface PlaybackState {
  device: {
    name: string;
    type: string;
    volume_percent: number;
  };
  isPlaying: boolean;
  item: {
    name: string;
    artists: { name: string }[];
    album: {
      name: string;
      images: { url: string; height: number; width: number }[];
    };
    duration: number;
  };
  progress: number;
}

interface QueueState {
  currently_playing: PlaybackState['item'];
  queue: PlaybackState['item'][];
}

interface SpotifyData {
  playback: PlaybackState | null;
  queue: QueueState | null;
}

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [data, setData] = useState<SpotifyData | null>(null);
  const [localProgress, setLocalProgress] = useState(0);
  const [dominantColor, setDominantColor] = useState<string>('#121212');
  const [loginUrl, setLoginUrl] = useState<string>('');
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Initial Auth Check
    const accessToken = localStorage.getItem('spotify_access_token');
    const refreshToken = localStorage.getItem('spotify_refresh_token');

    if (accessToken && accessToken !== 'undefined') {
      console.log("Found existing tokens, authenticating...");
      socket.emit('authenticate', { accessToken, refreshToken });
    }

    function onConnect() {
      console.log("Socket connected:", socket.id);
      setIsConnected(true);
      
      // Read fresh tokens from storage
      const storedAccess = localStorage.getItem('spotify_access_token');
      const storedRefresh = localStorage.getItem('spotify_refresh_token');

      if (storedAccess && storedAccess !== 'undefined') {
         console.log("Re-authenticating on connect...");
         socket.emit('authenticate', { accessToken: storedAccess, refreshToken: storedRefresh });
      }
      
      // Construct Login URL...
      let apiUrl = getApiUrl();
      apiUrl = apiUrl.replace(/\/$/, "");
      setLoginUrl(`${apiUrl}/login?socketId=${socket.id}`);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onLoginSuccess(tokens?: { accessToken: string, refreshToken: string }) {
      console.log("Logged in successfully!", tokens);
      if (tokens) {
          if (tokens.accessToken && tokens.accessToken !== 'undefined') {
             localStorage.setItem('spotify_access_token', tokens.accessToken);
          }
          if (tokens.refreshToken && tokens.refreshToken !== 'undefined') {
             localStorage.setItem('spotify_refresh_token', tokens.refreshToken);
          }
          
          // Immediately authenticate with the new tokens to start polling
          socket.emit('authenticate', { 
            accessToken: tokens.accessToken, 
            refreshToken: tokens.refreshToken 
          });
      }
      setIsLoggedIn(true);
    }

    function onPlaybackUpdate(newData: SpotifyData) {
      console.log("Received playback update:", newData);
      setData(newData);
      if (newData.playback) {
        setLocalProgress(newData.playback.progress || 0);
      }
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('login_success', onLoginSuccess);
    socket.on('playback_update', onPlaybackUpdate);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('login_success', onLoginSuccess);
      socket.off('playback_update', onPlaybackUpdate);
    };
  }, []);

  // Progress Bar Timer
  useEffect(() => {
    if (data?.playback?.isPlaying) {
      if (progressInterval.current) clearInterval(progressInterval.current);
      
      progressInterval.current = setInterval(() => {
        setLocalProgress((prev) => {
             const duration = data.playback?.item?.duration || 0;
             if (prev >= duration) return duration;
             return prev + 1000;
        });
      }, 1000);
    } else {
      if (progressInterval.current) clearInterval(progressInterval.current);
    }

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [data?.playback?.isPlaying, data?.playback?.item?.duration]);

  // Color Extraction
  useEffect(() => {
    const image = data?.playback?.item?.album?.images?.[0]?.url;
    if (image) {
      const fac = new FastAverageColor();
      fac.getColorAsync(image, { algorithm: 'dominant' })
        .then(color => {
          // If the color is too dark, it won't be visible against the dark background/overlay.
          // In that case, we default to White or Spotify Green.
          // Or we could try to "invert" it, but inversion of dark grey is light grey.
          // Simple heuristic:
          if (color.isDark) {
             setDominantColor('#ffffff'); // Fallback to white for visibility
          } else {
             setDominantColor(color.hex);
          }
        })
        .catch(e => {
          console.error("Error extracting color", e);
          setDominantColor('#1DB954'); // Fallback on error
        });
    }
  }, [data?.playback?.item?.album?.images?.[0]?.url]);

  const handleLogin = () => {
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    // Fallback to localhost if handleLogin is clicked manually (desktop flow)
    const apiUrl = getApiUrl().replace(/\/$/, "");
    window.open(
      `${apiUrl}/login?socketId=${socket.id}`,
      'Spotify Login',
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <h1>SpotiUI Kiosk</h1>
        <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
        
        {loginUrl && (
            <div style={{ background: 'white', padding: '1rem', borderRadius: '1rem', margin: '2rem' }}>
                <QRCodeSVG value={loginUrl} size={256} />
            </div>
        )}
        <p style={{ color: '#aaa', marginTop: '1rem' }}>Scan to Login</p>
        
        <button onClick={handleLogin} disabled={!isConnected} style={{ marginTop: '2rem', fontSize: '1rem', padding: '0.5rem 1rem' }}>
           Or click here (Debug)
        </button>
      </div>
    );
  }

  if (!data || !data.playback) {
    return (
      <>
        <div className="background-image default-bg" />
        <div className="background-overlay" />
        <div className="app-container" style={{ justifyContent: 'center' }}>
          {!isConnected && (
            <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'rgba(255, 0, 0, 0.7)',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                zIndex: 1000,
                backdropFilter: 'blur(4px)'
            }}>
                Reconnecting...
            </div>
          )}
          <div className="glass-panel waiting-panel">
            <div className="waiting-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <h1>Waiting for Playback</h1>
            <p>Start playing music on Spotify to see it here</p>
          </div>
        </div>
      </>
    );
  }

  const { item, isPlaying } = data.playback;
  const image = item?.album?.images?.[0]?.url;
  const duration = item?.duration || 1; 
  const progressPercent = (localProgress / duration) * 100;

  return (
    <>
      <div 
        className="background-image" 
        style={{ backgroundImage: `url(${image})` }} 
      />
      <div 
        className="background-overlay" 
        style={{ backgroundColor: dominantColor }} 
      />
      
      <div className="app-container">
        {!isConnected && (
            <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'rgba(255, 0, 0, 0.7)',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                zIndex: 1000,
                backdropFilter: 'blur(4px)'
            }}>
                Reconnecting...
            </div>
        )}
        <div className="glass-panel now-playing">
          {image && <img src={image} alt="Album Art" className="album-art" />}
          <div className="track-info">
            <h1 className="track-name">{item?.name}</h1>
            <h2 className="artist-name">{item?.artists?.map(a => a.name).join(', ')}</h2>
            <p className="album-name">{item?.album?.name}</p>
            
            <div className="progress-container">
               <div className="progress-bar-bg">
                  <div 
                    className="progress-bar-fill" 
                    style={{ 
                      width: `${progressPercent}%`, 
                      backgroundColor: dominantColor,
                      boxShadow: `0 0 15px ${dominantColor}`
                    }}
                  />
               </div>
               <div className="time-labels">
                 <span>{formatTime(localProgress)}</span>
                 <span>{formatTime(duration)}</span>
               </div>
            </div>

            <div className="status-badge">
              {isPlaying ? '▶ Playing' : '⏸ Paused'}
            </div>
          </div>
        </div>
        
        {data.queue && (
          <div className="glass-panel queue-container">
            <h3>Up Next</h3>
            <div className="queue-list">
              {data.queue.queue.slice(0, 4).map((track, i) => (
                <div key={i} className="queue-item">
                  <img 
                    src={track.album.images[0]?.url} 
                    alt={track.album.name} 
                  />
                  <div className="queue-text">
                    <span className="queue-track-name">{track.name}</span>
                    <span className="queue-artist-name">{track.artists[0].name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
