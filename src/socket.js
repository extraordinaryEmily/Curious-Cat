import { io } from 'socket.io-client';

// Dynamically determine the server URL based on current hostname
// This allows the app to work on localhost, network IPs, and production
const getServerUrl = () => {
  // In development, use the same hostname as the current page
  // This allows phones on the local network to connect
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // If accessing via localhost, use localhost for socket
    // If accessing via network IP (192.168.x.x, 10.x.x.x, etc.), use that IP
    return `http://${hostname}:3000`;
  }
  // Fallback for SSR or edge cases
  return 'http://localhost:3000';
};

export const socket = io(getServerUrl(), {
    autoConnect: false,
    reconnection: false, // Disable automatic reconnection
});

export const connectSocket = (isHost = false) => {
    return new Promise((resolve, reject) => {
        if (socket.connected) {
            resolve();
            return;
        }

        const onConnect = () => {
            console.log('Socket connected successfully');
            socket.off('connect', onConnect);
            socket.off('connect_error', onError);
            resolve();
        };

        const onError = (error) => {
            console.log('Socket connection error:', error);
            socket.off('connect', onConnect);
            socket.off('connect_error', onError);
            // Clear stored data on connection error
            if (!isHost) {
                clearPlayerData();
            }
            reject(error);
        };

        socket.once('connect', onConnect);
        socket.once('connect_error', onError);
        socket.connect();
    });
};

export const storePlayerData = (playerName, roomCode) => {
    try {
        localStorage.setItem('playerName', playerName);
        localStorage.setItem('roomCode', roomCode);
    } catch (error) {
        console.error('Error storing player data to localStorage:', error);
    }
};

export const clearPlayerData = () => {
    try {
        localStorage.removeItem('playerName');
        localStorage.removeItem('roomCode');
        localStorage.removeItem('attemptReconnect');
    } catch (error) {
        console.error('Error clearing player data from localStorage:', error);
    }
};

socket.on('connect', () => {
    console.log('Connected to server');
    
    // Only attempt reconnection if explicitly requested
    try {
        const shouldReconnect = localStorage.getItem('attemptReconnect');
        if (shouldReconnect) {
            const playerName = localStorage.getItem('playerName');
            const roomCode = localStorage.getItem('roomCode');
            
            if (playerName && roomCode) {
                console.log('Attempting to reconnect with stored data');
                socket.emit('attempt_reconnect', { playerName, roomCode });
            }
            localStorage.removeItem('attemptReconnect');
        }
    } catch (error) {
        console.error('Error accessing localStorage for reconnection:', error);
    }
});

socket.on('reconnect_failed', () => {
    console.log('Reconnection failed - clearing stored data');
    clearPlayerData();
});

socket.on('join_error', () => {
    console.log('Join error - clearing stored data');
    clearPlayerData();
});

socket.on('game_ended', () => {
    console.log('Game ended - clearing stored data');
    clearPlayerData();
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

socket.on('connect_error', (error) => {
    console.log('Connection error:', error);
    // Only clear data if we've exceeded reconnection attempts
    if (socket.io.attempts >= socket.io._reconnectionAttempts) {
        clearPlayerData();
    }
});

