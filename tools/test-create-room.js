const io = require('socket.io-client');

const socket = io('http://localhost:3000', { reconnection: false, autoConnect: false });

socket.on('connect', () => {
  console.log('[test] connected with id', socket.id);
  socket.emit('create_room', { numberOfRounds: 3 });
});

socket.on('room_created', (code) => {
  console.log('[test] room_created received:', code);
  socket.disconnect();
});

socket.on('connect_error', (err) => {
  console.error('[test] connect_error', err);
});

socket.on('error', (err) => {
  console.error('[test] socket error', err);
});

socket.connect();
