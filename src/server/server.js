'use strict';

const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const { RoomManager } = require('./room');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'heyuan-mahjong', now: Date.now() });
});

const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 32 * 1024,
  pingTimeout: 20000,
});
const manager = new RoomManager(io);

function sendAck(ack, payload) {
  if (typeof ack === 'function') ack(payload);
}

function failAck(ack, error) {
  const message = error && error.message ? error.message : '操作失败，请重试';
  sendAck(ack, { ok: false, error: message });
}

io.on('connection', (socket) => {
  const clientId = String(socket.handshake.auth?.clientId || '');
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(clientId)) {
    socket.emit('server:error', { error: '连接标识无效，请刷新页面' });
    socket.disconnect(true);
    return;
  }
  socket.data.clientId = clientId;

  socket.on('room:create', (payload, ack) => {
    try {
      const room = manager.createRoom(clientId, payload?.profile, socket);
      sendAck(ack, { ok: true, code: room.code });
    } catch (error) {
      failAck(ack, error);
    }
  });

  socket.on('room:join', (payload, ack) => {
    try {
      const room = manager.joinRoom(clientId, payload?.code, payload?.profile, socket);
      sendAck(ack, { ok: true, code: room.code });
    } catch (error) {
      failAck(ack, error);
    }
  });

  socket.on('room:resume', (payload, ack) => {
    try {
      const room = manager.resume(clientId, payload?.code, socket);
      sendAck(ack, { ok: true, code: room.code });
    } catch (error) {
      failAck(ack, error);
    }
  });

  socket.on('room:seat', (payload, ack) => {
    try {
      const room = manager.getRoomForClient(clientId);
      if (!room) throw new Error('你不在房间里');
      room.moveSeat(clientId, payload?.seat);
      sendAck(ack, { ok: true });
    } catch (error) {
      failAck(ack, error);
    }
  });

  socket.on('room:start', (payload, ack) => {
    try {
      const room = manager.getRoomForClient(clientId);
      if (!room) throw new Error('你不在房间里');
      room.startGame(clientId);
      sendAck(ack, { ok: true });
    } catch (error) {
      failAck(ack, error);
    }
  });

  socket.on('room:nextRound', (payload, ack) => {
    try {
      const room = manager.getRoomForClient(clientId);
      if (!room) throw new Error('你不在房间里');
      room.startNextRound(clientId);
      sendAck(ack, { ok: true });
    } catch (error) {
      failAck(ack, error);
    }
  });

  socket.on('room:leave', (payload, ack) => {
    try {
      manager.leave(clientId);
      sendAck(ack, { ok: true });
    } catch (error) {
      failAck(ack, error);
    }
  });

  socket.on('game:action', (payload, ack) => {
    try {
      const room = manager.getRoomForClient(clientId);
      if (!room) throw new Error('你不在房间里');
      room.performAction(clientId, payload?.action);
      sendAck(ack, { ok: true });
    } catch (error) {
      failAck(ack, error);
    }
  });

  socket.on('disconnect', () => {
    manager.disconnect(socket, clientId);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`合院棋牌室已启动: http://localhost:${PORT}`);
});

module.exports = { app, server, io };
