const socket = io();

const paper = document.getElementById('paper');
const modal = document.getElementById('input-modal');
const input = document.getElementById('message-input');
const btnCancel = document.getElementById('btn-cancel');
const btnSend = document.getElementById('btn-send');
const statusText = document.getElementById('connection-status');
const roomIdText = document.getElementById('room-id');
const btnShare = document.getElementById('btn-share');

// State
let currentX = 0;
let currentY = 0;
let roomId = 'default-room';

// Get room from URL or generate one
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('room')) {
  roomId = urlParams.get('room');
} else {
  // Generate a random room id and update URL
  roomId = Math.random().toString(36).substr(2, 6);
  window.history.replaceState({}, '', `?room=${roomId}`);
}

roomIdText.textContent = roomId;

// Colors and fonts to make it look like different pens
const colors = ['#1a1a1a', '#1e3a8a', '#831843', '#14532d', '#701a75', '#8b6914'];
const fonts = ["'Caveat', cursive", "'Dancing Script', cursive", "'Patrick Hand', cursive", "'Indie Flower', cursive"];

// Assign a random pen style to this client
const myColor = colors[Math.floor(Math.random() * colors.length)];
const myFont = fonts[Math.floor(Math.random() * fonts.length)];
const myRotation = (Math.random() * 6 - 3).toFixed(1); // slight rotation for handwriting feel

// Socket Events
socket.on('connect', () => {
  statusText.textContent = 'Đã kết nối';
  statusText.classList.add('connected');
  socket.emit('join_room', roomId);
});

socket.on('disconnect', () => {
  statusText.textContent = 'Mất kết nối';
  statusText.classList.remove('connected');
});

socket.on('load_messages', (messages) => {
  paper.innerHTML = ''; // Clear paper
  messages.forEach(msg => renderMessage(msg));
});

socket.on('receive_message', (msg) => {
  renderMessage(msg);
});

socket.on('room_cleared', () => {
  paper.innerHTML = '';
});

// Render message on paper
function renderMessage(msg) {
  // Prevent duplicate rendering
  if (document.getElementById(`msg-${msg.id}`)) return;

  const el = document.createElement('div');
  el.id = `msg-${msg.id}`;
  el.className = 'message';
  el.textContent = msg.text;
  
  el.style.left = `${msg.x}px`;
  el.style.top = `${msg.y}px`;
  el.style.color = msg.color;
  el.style.fontFamily = msg.font;
  el.style.transform = `translate(-50%, -50%) rotate(${msg.rotation}deg)`;
  
  paper.appendChild(el);
}

// Interaction
paper.addEventListener('click', (e) => {
  if (e.target !== paper) return; // Ignore clicks on existing messages
  
  // Calculate relative to paper (in case of scrolling/zooming later)
  const rect = paper.getBoundingClientRect();
  currentX = e.clientX - rect.left;
  currentY = e.clientY - rect.top;
  
  modal.classList.remove('hidden');
  input.value = '';
  input.focus();
});

function hideModal() {
  modal.classList.add('hidden');
  input.value = '';
}

btnCancel.addEventListener('click', hideModal);

btnSend.addEventListener('click', () => {
  const text = input.value.trim();
  if (text) {
    socket.emit('send_message', {
      roomId,
      message: {
        text,
        x: currentX,
        y: currentY,
        color: myColor,
        font: myFont,
        rotation: myRotation
      }
    });
  }
  hideModal();
});

// Enter to send
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    btnSend.click();
  }
});

// Share link
btnShare.addEventListener('click', () => {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    const oldText = btnShare.textContent;
    btnShare.textContent = 'Đã copy link!';
    setTimeout(() => btnShare.textContent = oldText, 2000);
  });
});
