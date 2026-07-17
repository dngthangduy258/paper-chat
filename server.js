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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Duy@PaperChat2026!';

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

// API Endpoint to ban a user
app.post('/api/ban-user', (req, res) => {
  const { roomId, password, userId, deleteMessages } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Sai mật khẩu Admin!' });
  }
  if (!roomId || !rooms[roomId]) {
    return res.status(404).json({ success: false, message: 'Phòng không tồn tại.' });
  }
  if (!userId) {
    return res.status(400).json({ success: false, message: 'Thiếu userId cần ban.' });
  }

  rooms[roomId].bannedUsers.add(userId);
  
  if (deleteMessages) {
    // Remove all messages from this user
    rooms[roomId].messages = rooms[roomId].messages.filter(msg => msg.userId !== userId);
    // Broadcast event so clients remove messages from this user
    io.to(roomId).emit('user_banned', userId);
    return res.json({ success: true, message: 'Đã cấm người dùng và xóa các tin nhắn của họ!' });
  } else {
    return res.json({ success: true, message: 'Đã cấm người dùng (Giữ nguyên tin nhắn cũ)!' });
  }
});

// API Endpoint to delete a specific message
app.post('/api/delete-message', (req, res) => {
  const { roomId, password, msgId } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Sai mật khẩu Admin!' });
  }
  if (!roomId || !rooms[roomId]) {
    return res.status(404).json({ success: false, message: 'Phòng không tồn tại.' });
  }

  // Filter out the message
  const initialLength = rooms[roomId].messages.length;
  rooms[roomId].messages = rooms[roomId].messages.filter(msg => msg.id !== msgId);
  
  if (rooms[roomId].messages.length < initialLength) {
    // Message was deleted, broadcast to clients
    io.to(roomId).emit('message_deleted', msgId);
    return res.json({ success: true, message: 'Đã xóa tin nhắn!' });
  } else {
    return res.status(404).json({ success: false, message: 'Không tìm thấy tin nhắn.' });
  }
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
      rooms[roomId] = { messages: [], isLocked: false, bannedUsers: new Set() };
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

    if (rooms[roomId] && rooms[roomId].bannedUsers.has(message.userId)) {
      // User is banned, ignore message
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
