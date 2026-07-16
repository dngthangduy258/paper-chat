const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// In-memory storage for rooms and messages
const rooms = {};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join a room (a specific paper session)
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = { messages: [] };
    }
    // Send existing messages to the newly connected user
    socket.emit('load_messages', rooms[roomId].messages);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // Handle new message
  socket.on('send_message', (data) => {
    const { roomId, message } = data;
    
    // Add unique ID to message
    const msg = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      ...message
    };
    
    if (rooms[roomId]) {
      rooms[roomId].messages.push(msg);
      
      // Broadcast to everyone in the room (including sender)
      io.to(roomId).emit('receive_message', msg);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Paper Chat server is running on http://localhost:${PORT}`);
});
