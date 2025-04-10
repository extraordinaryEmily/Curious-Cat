import { io } from 'socket.io-client';

export const socket = io('http://localhost:3000', {
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
    localStorage.setItem('playerName', playerName);
    localStorage.setItem('roomCode', roomCode);
};

export const clearPlayerData = () => {
    localStorage.removeItem('playerName');
    localStorage.removeItem('roomCode');
    localStorage.removeItem('attemptReconnect');
};

socket.on('connect', () => {
    console.log('Connected to server');
    
    // Only attempt reconnection if explicitly requested
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

