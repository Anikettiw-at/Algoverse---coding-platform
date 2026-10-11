/**
 * sockets/collabSocket.js
 *
 * Namespace: /collab
 *
 * Design note: Monaco editor ka `onDidChangeModelContent` event ek
 * `changes[]` array deta hai — har change = { range, text, rangeLength }.
 * Hum in raw deltas ko dusre user tak forward karte hain aur wo unhe
 * `editor.executeEdits()` se apply karta hai. Isse:
 *   - Poore document ka diff nikaalne ki zaroorat nahi padti
 *   - Remote user ka cursor "jump" nahi karta (sirf uske relevant hisse me edit hota hai)
 *
 * Server current full text bhi Redis me maintain karta hai (deltas apply
 * karke) — taaki jab koi teesra/naya user room join kare, use scratch se
 * shuru na karna pade, latest code turant mil jaye.
 *
 * NOTE: 2 se zyada concurrent editors ke liye ye delta-forwarding approach
 * conflict-prone ho sakta hai (true OT/CRDT nahi hai). Abhi 2-user collab
 * ke liye kaafi hai. Agar aage group-collab chahiye to Yjs + y-monaco
 * integrate karna — wahan CRDT built-in hota hai.
 *
 * Events (client -> server):
 *   collab:create_room     {}                         -> collab:room_created { roomId }
 *   collab:join_room       { roomId }                  -> collab:sync_state { code, language, theme }
 *   collab:code_change     { roomId, changes }         -> broadcast collab:remote_change
 *   collab:cursor_position { roomId, position, selection } -> broadcast collab:remote_cursor
 *   collab:language_change { roomId, language }        -> broadcast collab:remote_language_change
 *   collab:theme_change    { roomId, theme }           -> broadcast collab:remote_theme_change
 */

const { randomUUID } = require('crypto');
const redisClient = require('../config/redis'); // tumhare redis.js ka `module.exports = redisClient` yahan directly milta hai

const collabStateKey = (roomId) => `collab:${roomId}:state`; // HASH { code, language, theme, creatorId }
const ROOM_TTL_SECONDS = 24 * 60 * 60; // inactive rooms 24h baad Redis se khud hat jaate hain
const ALLOWED_LANGUAGES = ['javascript', 'cpp', 'java'];
const ALLOWED_THEMES = ['vs-dark', 'light', 'hc-black'];
const MAX_CODE_LENGTH = 100000;

// Har room ke edits ek-ek karke apply hon (Redis read-modify-write interleave na ho)
const roomQueues = new Map();
function enqueueForRoom(roomId, task) {
  const prev = roomQueues.get(roomId) || Promise.resolve();
  const next = prev.then(task, task);
  roomQueues.set(roomId, next);
  next.finally(() => {
    if (roomQueues.get(roomId) === next) roomQueues.delete(roomId);
  });
  return next;
}

const DEFAULT_STATE = {
  code: '// Start coding together...\n',
  language: 'javascript',
  theme: 'vs-dark',
};

/**
 * Monaco ke line/column position ko plain string offset me convert karta hai.
 */
function lineColToOffset(text, lineNumber, column) {
  const lines = text.split('\n');
  let offset = 0;
  for (let i = 0; i < lineNumber - 1; i++) {
    offset += lines[i].length + 1; // +1 newline character ke liye
  }
  return offset + (column - 1);
}

/**
 * Ek Monaco change object { range, text } ko current text par apply karke
 * naya text return karta hai.
 */
function applySingleChange(currentText, change) {
  const { range, text } = change || {};
  if (!range || typeof text !== 'string') throw new Error('Malformed change');
  const startOffset = lineColToOffset(currentText, range.startLineNumber, range.startColumn);
  const endOffset = lineColToOffset(currentText, range.endLineNumber, range.endColumn);
  return currentText.slice(0, startOffset) + text + currentText.slice(endOffset);
}

function applyChanges(currentText, changes) {
  let updated = currentText;
  // Monaco changes array me multiple simultaneous edits ho sakte hain
  // (e.g. multi-cursor) — order se apply karo.
  for (const change of changes) {
    updated = applySingleChange(updated, change);
  }
  return updated;
}

module.exports = function registerCollabNamespace(collabNsp) {
  collabNsp.on('connection', (socket) => {
    const userId = socket.data.userId;

    socket.on('collab:create_room', async () => {
      try {
        const roomId = randomUUID();
        await redisClient.hSet(collabStateKey(roomId), {
          ...DEFAULT_STATE,
          creatorId: userId,
        });
        await redisClient.expire(collabStateKey(roomId), ROOM_TTL_SECONDS);
        socket.join(roomId);
        socket.emit('collab:room_created', { roomId, ...DEFAULT_STATE });
      } catch (err) {
        socket.emit('collab:error', { message: 'Could not create room' });
        console.error('[collabSocket] create_room error:', err.message);
      }
    });

    socket.on('collab:join_room', async ({ roomId } = {}) => {
      try {
        if (typeof roomId !== 'string' || !roomId) {
          socket.emit('collab:error', { message: 'Room does not exist' });
          return;
        }
        const state = await redisClient.hGetAll(collabStateKey(roomId));
        if (!state || Object.keys(state).length === 0) {
          socket.emit('collab:error', { message: 'Room does not exist' });
          return;
        }
        socket.join(roomId);
        socket.emit('collab:sync_state', {
          code: state.code,
          language: state.language,
          theme: state.theme,
        });
        socket.to(roomId).emit('collab:user_joined', { userId });
      } catch (err) {
        socket.emit('collab:error', { message: 'Could not join room' });
        console.error('[collabSocket] join_room error:', err.message);
      }
    });

    socket.on('collab:code_change', ({ roomId, changes } = {}) => enqueueForRoom(roomId, async () => {
      try {
        // Sirf room ke member hi edit kar sakte hain
        if (!socket.rooms.has(roomId)) return;
        if (!Array.isArray(changes) || changes.length === 0) return;

        const state = await redisClient.hGetAll(collabStateKey(roomId));
        if (!state || Object.keys(state).length === 0) return;

        const updatedText = applyChanges(state.code ?? '', changes);
        if (updatedText.length > MAX_CODE_LENGTH) throw new Error('Document too large');
        await redisClient.hSet(collabStateKey(roomId), { code: updatedText });
        await redisClient.expire(collabStateKey(roomId), ROOM_TTL_SECONDS);

        // Sirf dusre participant(s) ko bhejo — sender ko wapas apna hi
        // change echo nahi karna (warna cursor jump/duplicate-apply hoga).
        socket.to(roomId).emit('collab:remote_change', { changes, senderId: userId });
      } catch (err) {
        console.error('[collabSocket] code_change error:', err.message);
        // Agar apply fail ho jaye (out-of-sync ho gaya), poori state re-sync
        // bhej do taaki client automatically recover ho jaye.
        const fallbackState = await redisClient.hGetAll(collabStateKey(roomId)).catch(() => null);
        if (fallbackState) {
          collabNsp.to(roomId).emit('collab:sync_state', {
            code: fallbackState.code,
            language: fallbackState.language,
            theme: fallbackState.theme,
          });
        }
      }
    }));

    socket.on('collab:cursor_position', ({ roomId, position, selection } = {}) => {
      if (!socket.rooms.has(roomId)) return;
      socket.to(roomId).emit('collab:remote_cursor', { userId, position, selection });
    });

    socket.on('collab:language_change', async ({ roomId, language } = {}) => {
      try {
        if (!socket.rooms.has(roomId) || !ALLOWED_LANGUAGES.includes(language)) return;
        await redisClient.hSet(collabStateKey(roomId), { language });
        socket.to(roomId).emit('collab:remote_language_change', { language });
      } catch (err) {
        console.error('[collabSocket] language_change error:', err.message);
      }
    });

    socket.on('collab:theme_change', async ({ roomId, theme } = {}) => {
      try {
        if (!socket.rooms.has(roomId) || !ALLOWED_THEMES.includes(theme)) return;
        await redisClient.hSet(collabStateKey(roomId), { theme });
        socket.to(roomId).emit('collab:remote_theme_change', { theme });
      } catch (err) {
        console.error('[collabSocket] theme_change error:', err.message);
      }
    });

    socket.on('disconnecting', () => {
      // socket.rooms me abhi bhi rooms dikhte hain 'disconnect' se pehle
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) continue; // socket ka apna default room skip karo
        socket.to(roomId).emit('collab:user_left', { userId });
      }
    });
  });
};