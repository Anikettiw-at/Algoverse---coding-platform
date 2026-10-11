/**
 * utils/roomManager.js
 *
 * Saara Redis I/O (matchmaking + room lifecycle) yahin hota hai, taaki
 * socket handlers thin/testable rahein — unhe Redis ke internals ka
 * pata na ho.
 *
 * KEY SCHEMA
 * ----------
 * queue:battle                        -> LIST of JSON {userId, socketId, rating, queuedAt}
 * room:<roomId>                       -> HASH  {status, problemId, startTime, duration,
 *                                               player1Id, player2Id, winnerId, endReason}
 * room:<roomId>:player:<userId>       -> HASH  {socketId, passed, total, codeLines,
 *                                               lastSubmissionAt, status}
 * user:<userId>:socket                -> STRING socketId   (user ka current live socket)
 * socket:<socketId>:user              -> STRING userId     (reverse lookup)
 * socket:<socketId>:room              -> STRING roomId     (socket kis room me hai)
 *
 * Har room hash pe TTL laga hai (safety net) — agar cleanup event miss ho
 * jaye (server crash mid-battle), to Redis me dead rooms hamesha ke liye
 * nahi rehte.
 */

// NOTE: tumhare config/redis.js jo bhi export kare (module.exports = redisClient),
// wahi yahan destructure ho raha hai. Agar tumhare file me export ka naam
// alag hai (e.g. `module.exports = redis;`), to bas neeche wali line ka
// variable name match kar lena — logic same rahega.
const redisClient = require('../config/redis');
const { randomUUID } = require('crypto');

const QUEUE_KEY = 'queue:battle';
const ROOM_TTL_SECONDS = 60 * 60; // 1hr safety-net expiry, kisi bhi room hash ke liye

const roomKey = (roomId) => `room:${roomId}`;
const playerKey = (roomId, userId) => `room:${roomId}:player:${userId}`;
const userSocketKey = (userId) => `user:${userId}:socket`;
const socketUserKey = (socketId) => `socket:${socketId}:user`;
const socketRoomKey = (socketId) => `socket:${socketId}:room`;

// ---------------------------------------------------------------------------
// Socket <-> User mapping (disconnect / reconnect handling ke liye zaroori)
// ---------------------------------------------------------------------------

async function bindSocketToUser(socketId, userId) {
  await redisClient.set(userSocketKey(userId), socketId);
  await redisClient.set(socketUserKey(socketId), userId);
}

async function getUserBySocket(socketId) {
  return redisClient.get(socketUserKey(socketId));
}

async function getSocketByUser(userId) {
  return redisClient.get(userSocketKey(userId));
}

async function bindSocketToRoom(socketId, roomId) {
  await redisClient.set(socketRoomKey(socketId), roomId);
}

async function getRoomBySocket(socketId) {
  return redisClient.get(socketRoomKey(socketId));
}

async function clearSocketMapping(socketId) {
  const userId = await getUserBySocket(socketId);
  await redisClient.del(socketUserKey(socketId));
  await redisClient.del(socketRoomKey(socketId));
  return userId;
}

// ---------------------------------------------------------------------------
// Matchmaking queue
// ---------------------------------------------------------------------------

/**
 * User ko queue me daalta hai. De-dupe karta hai: agar user already queue
 * me hai (duplicate tab/click), pehle uski purani entry hata di jaati hai.
 */
async function joinQueue(userId, socketId, meta = {}) {
  await leaveQueue(userId); // de-dupe pehle
  const entry = JSON.stringify({
    userId,
    socketId,
    rating: meta.rating ?? 0,
    queuedAt: Date.now(),
  });
  await redisClient.rPush(QUEUE_KEY, entry);
}

async function leaveQueue(userId) {
  const all = await redisClient.lRange(QUEUE_KEY, 0, -1);
  for (const raw of all) {
    const parsed = JSON.parse(raw);
    if (parsed.userId === userId) {
      await redisClient.lRem(QUEUE_KEY, 1, raw);
    }
  }
}

/**
 * Queue ke front se do waiting players pop karne ki koshish karta hai.
 * Agar 2 se kam log wait kar rahe hain to null return karega.
 * FIFO matching use ho rahi hai — baad me rating-bucketed matching
 * (skill-based pairing) laga sakte ho.
 */
async function tryMatchTwoPlayers() {
  const queueLength = await redisClient.lLen(QUEUE_KEY);
  if (queueLength < 2) return null;

  const rawA = await redisClient.lPop(QUEUE_KEY);
  const rawB = await redisClient.lPop(QUEUE_KEY);

  if (!rawA || !rawB) {
    // Race condition safety: agar pop karte waqt sirf ek hi bacha tha,
    // use wapas push karke bail out karo.
    if (rawA) await redisClient.lPush(QUEUE_KEY, rawA);
    if (rawB) await redisClient.lPush(QUEUE_KEY, rawB);
    return null;
  }

  return { playerA: JSON.parse(rawA), playerB: JSON.parse(rawB) };
}

// ---------------------------------------------------------------------------
// Room lifecycle
// ---------------------------------------------------------------------------

async function createBattleRoom({ player1, player2, problem, durationMs }) {
  const roomId = randomUUID();
  const startTime = Date.now();

  await redisClient.hSet(roomKey(roomId), {
    status: 'active',
    problemId: String(problem.id),
    startTime: String(startTime),
    duration: String(durationMs),
    player1Id: player1.userId,
    player2Id: player2.userId,
    winnerId: '',
    endReason: '',
  });
  await redisClient.expire(roomKey(roomId), ROOM_TTL_SECONDS);

  for (const player of [player1, player2]) {
    const key = playerKey(roomId, player.userId);
    await redisClient.hSet(key, {
      socketId: player.socketId,
      passed: '0',
      total: String(problem.totalTestCases ?? 0),
      codeLines: '0',
      lastSubmissionAt: '',
      status: 'in_progress', // in_progress | passed_all | forfeited | disconnected
    });
    await redisClient.expire(key, ROOM_TTL_SECONDS);
  }

  return { roomId, startTime };
}

async function getRoom(roomId) {
  const data = await redisClient.hGetAll(roomKey(roomId));
  if (!data || Object.keys(data).length === 0) return null;
  return data;
}

async function getPlayerState(roomId, userId) {
  const data = await redisClient.hGetAll(playerKey(roomId, userId));
  if (!data || Object.keys(data).length === 0) return null;
  return data;
}

async function getOpponentId(roomId, userId) {
  const room = await getRoom(roomId);
  if (!room) return null;
  return room.player1Id === userId ? room.player2Id : room.player1Id;
}

/**
 * Player ke stored state me partial progress update merge karta hai.
 * Sirf whitelisted fields hi likhe jaate hain (arbitrary hash pollution
 * se bachne ke liye).
 */
async function updatePlayerProgress(roomId, userId, updates) {
  const allowed = ['passed', 'total', 'codeLines', 'lastSubmissionAt', 'status'];
  const toWrite = {};
  for (const field of allowed) {
    if (updates[field] !== undefined) toWrite[field] = String(updates[field]);
  }
  if (Object.keys(toWrite).length === 0) return;
  await redisClient.hSet(playerKey(roomId, userId), toWrite);
}

async function finalizeRoom(roomId, { winnerId, endReason }) {
  await redisClient.hSet(roomKey(roomId), {
    status: 'ended',
    winnerId: winnerId || '',
    endReason: endReason || 'completed',
  });
}

async function deleteRoom(roomId) {
  const room = await getRoom(roomId);
  if (!room) return;
  await redisClient.del(roomKey(roomId));
  await redisClient.del(playerKey(roomId, room.player1Id));
  await redisClient.del(playerKey(roomId, room.player2Id));
}

module.exports = {
  bindSocketToUser,
  getUserBySocket,
  getSocketByUser,
  bindSocketToRoom,
  getRoomBySocket,
  clearSocketMapping,
  joinQueue,
  leaveQueue,
  tryMatchTwoPlayers,
  createBattleRoom,
  getRoom,
  getPlayerState,
  getOpponentId,
  updatePlayerProgress,
  finalizeRoom,
  deleteRoom,
};