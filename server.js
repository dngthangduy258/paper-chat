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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// API Endpoint to clear a room
app.post('/api/clear-room', (req, res) => {
  const { roomId, password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Sai mật khẩu Admin!' });
  }
  if (!roomId || !rooms[roomId]) {
    return res.status(404).json({ success: false, message: 'Phòng không tồn tại hoặc đã trống.' });
  }

  // Clear messages in memory
  rooms[roomId].messages = [];

  // Broadcast to clients in this room to clear their UI
  io.to(roomId).emit('room_cleared');

  return res.json({ success: true, message: 'Đã xóa trắng phòng thành công!' });
});

// API Endpoint to toggle lock status
app.post('/api/toggle-lock', (req, res) => {
  const { roomId, password, lock } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Sai mật khẩu Admin!' });
  }
  if (!roomId || !rooms[roomId]) {
    return res.status(404).json({ success: false, message: 'Phòng không tồn tại.' });
  }

  rooms[roomId].isLocked = !!lock;
  const eventName = rooms[roomId].isLocked ? 'room_locked' : 'room_unlocked';
  io.to(roomId).emit(eventName);

  const statusMsg = rooms[roomId].isLocked ? 'đã bị KHÓA chat' : 'đã MỞ KHÓA chat';
  return res.json({ success: true, message: `Phòng ${roomId} ${statusMsg} thành công!` });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join a room (a specific paper session)
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = { messages: [], isLocked: false };
    }
    // Send existing messages and room state
    socket.emit('load_messages', rooms[roomId].messages);
    socket.emit(rooms[roomId].isLocked ? 'room_locked' : 'room_unlocked');
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // Handle new message
  socket.on('send_message', (data) => {
    const { roomId, message } = data;
    
    if (rooms[roomId] && rooms[roomId].isLocked) {
      // Room is locked, ignore message
      return;
    }

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
