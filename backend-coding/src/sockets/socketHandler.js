const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const { allowedOrigins } = require('../config/origins');

const redisClient = require('../config/redis');
const registerBattleNamespace = require('./battleSocket');
const registerCollabNamespace = require('./collabSocket');

const COOKIE_NAME = 'token'; // Tumhare JWT cookie ka naam

function authenticateSocket(socket, next) {
  try {
    const rawCookieHeader = socket.handshake.headers?.cookie;
    if (!rawCookieHeader) {
      return next(new Error('Authentication required: no cookie sent'));
    }

    const parsedCookies = cookie.parse(rawCookieHeader);
    const token = parsedCookies[COOKIE_NAME];
    if (!token) {
      return next(new Error('Authentication required: token missing'));
    }

    const decoded = jwt.verify(token, process.env.JWT_KEY);
    socket.data.userId = String(decoded._id || decoded.userId || decoded.id || '');

    if (!socket.data.userId) {
      return next(new Error('Authentication failed: malformed token payload'));
    }

    // Logout ho chuka token socket pe bhi valid nahi hona chahiye
    redisClient.exists(`token:${token}`)
      .then((isBlocked) => {
        if (isBlocked) return next(new Error('Authentication failed: token revoked'));
        next();
      })
      .catch(() => next(new Error('Authentication failed: could not verify token')));
  } catch (err) {
    next(new Error('Authentication failed: ' + err.message));
  }
}

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  const battleNsp = io.of('/battle');
  const collabNsp = io.of('/collab');

  battleNsp.use(authenticateSocket);
  collabNsp.use(authenticateSocket);

  registerBattleNamespace(battleNsp);
  registerCollabNamespace(collabNsp);

  console.log('🔌 Socket.io initialized — namespaces: /battle, /collab');

  return io;
}

module.exports = { initSocket };