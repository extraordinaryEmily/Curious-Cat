import { io } from 'socket.io-client';

export const socket = io('http://localhost:3000', {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
});

// Store player data in localStorage when it's set
export const storePlayerData = (playerName, roomCode) => {
    localStorage.setItem('playerName', playerName);
    localStorage.setItem('roomCode', roomCode);
    socket.emit('store_player_data', { playerName, roomCode });
};

// Clear player data
export const clearPlayerData = () => {
    localStorage.removeItem('playerName');
    localStorage.removeItem('roomCode');
};

socket.on('connect', () => {
    console.log('Connected to server');
    
    // Attempt reconnection if we have stored data
    const playerName = localStorage.getItem('playerName');
    const roomCode = localStorage.getItem('roomCode');
    
    if (playerName && roomCode) {
        socket.emit('attempt_reconnect', { playerName, roomCode });
    }
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

socket.on('connect_error', (error) => {
    console.log('Connection error:', error);
});
