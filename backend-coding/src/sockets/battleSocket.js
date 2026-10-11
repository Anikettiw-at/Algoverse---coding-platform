/**
 * sockets/battleSocket.js
 *
 * Namespace: /battle
 *
 * Server hi authoritative hai:
 *   - problem DB se random choose hota hai
 *   - final submit ka code server Judge0 pe hidden test cases ke against chalata hai
 *   - winner server decide karta hai (client ka "maine jeet liya" event trust nahi karte)
 *
 * NOTE: queue aur rooms abhi process memory me hain (single server instance ke liye
 * theek hai). Multiple instances pe scale karna ho to utils/roomManager.js (Redis)
 * + @socket.io/redis-adapter use karna.
 */

const { randomUUID } = require('crypto');
const Problem = require('../models/problem');
const { getLanguageById, runTestCases } = require('../utils/problemUtility');
const { summarizeResults } = require('../controllers/userSubmission');

const BATTLE_DURATION_MS = 15 * 60 * 1000;
const RECONNECT_GRACE_MS = 60 * 1000;
const ROOM_CLEANUP_MS = 5 * 60 * 1000;

let battleQueue = []; // [{ userId, socketId }]
const rooms = new Map(); // roomId -> room
const userRoom = new Map(); // userId -> roomId (active battle)

function publicProblem(problem) {
  return {
    id: String(problem._id),
    title: problem.title,
    difficulty: problem.difficulty,
    description: problem.description,
    visibleTestCases: problem.visibleTestCases,
    startCode: problem.startCode,
    totalTestCases: problem.hiddenTestCases.length,
  };
}

function snapshotFor(room, userId) {
  const opponentId = room.playerIds.find((id) => id !== userId);
  const me = room.players[userId];
  const opponent = room.players[opponentId];
  return {
    roomId: room.roomId,
    problem: room.problem,
    startTime: room.startTime,
    duration: room.duration,
    status: room.status,
    winnerId: room.winnerId,
    endReason: room.endReason,
    opponent: { userId: opponentId },
    me: { codeLines: me.codeLines, passed: me.passed, total: me.total },
    opponentState: { codeLines: opponent.codeLines, passed: opponent.passed, total: opponent.total },
  };
}

function registerBattleNamespace(battleNsp) {

  function endBattle(room, winnerId, reason) {
    if (room.status !== 'active') return;
    room.status = 'ended';
    room.winnerId = winnerId;
    room.endReason = reason;
    clearTimeout(room.timeoutTimer);
    for (const id of room.playerIds) {
      clearTimeout(room.players[id].graceTimer);
      if (userRoom.get(id) === room.roomId) userRoom.delete(id);
    }
    battleNsp.to(room.roomId).emit('battle:ended', { winnerId, reason });
    setTimeout(() => rooms.delete(room.roomId), ROOM_CLEANUP_MS);
  }

  // Socket kisi room ka valid player hai ya nahi
  function getPlayerRoom(socket, roomId) {
    const room = rooms.get(roomId);
    if (!room || !room.players[socket.data.userId]) return null;
    return room;
  }

  async function createMatch(player1, player2) {
    const [problem] = await Problem.aggregate([
      { $match: { 'hiddenTestCases.0': { $exists: true } } },
      { $sample: { size: 1 } },
    ]);

    if (!problem) {
      for (const p of [player1, player2]) {
        battleNsp.to(p.socketId).emit('battle:error', { message: 'No problems available for battle yet' });
      }
      return;
    }

    const roomId = randomUUID();
    const total = problem.hiddenTestCases.length;
    const room = {
      roomId,
      problemId: String(problem._id),
      problem: publicProblem(problem),
      startTime: Date.now(),
      duration: BATTLE_DURATION_MS,
      status: 'active',
      winnerId: null,
      endReason: null,
      playerIds: [player1.userId, player2.userId],
      players: {
        [player1.userId]: { socketId: player1.socketId, passed: 0, total, codeLines: 0, judging: false, graceTimer: null },
        [player2.userId]: { socketId: player2.socketId, passed: 0, total, codeLines: 0, judging: false, graceTimer: null },
      },
    };
    rooms.set(roomId, room);

    for (const p of [player1, player2]) {
      userRoom.set(p.userId, roomId);
      battleNsp.sockets.get(p.socketId)?.join(roomId);
    }

    // Time khatam: jiske zyada hidden tests pass hue wo jeeta, barabar ho to draw
    room.timeoutTimer = setTimeout(() => {
      const [a, b] = room.playerIds;
      const pa = room.players[a].passed;
      const pb = room.players[b].passed;
      endBattle(room, pa === pb ? null : pa > pb ? a : b, 'timeout');
    }, room.duration);

    for (const p of [player1, player2]) {
      const opponentId = p.userId === player1.userId ? player2.userId : player1.userId;
      battleNsp.to(p.socketId).emit('match_found', {
        roomId,
        problem: room.problem,
        startTime: room.startTime,
        duration: room.duration,
        opponent: { userId: opponentId },
      });
    }
  }

  battleNsp.on('connection', (socket) => {
    const userId = socket.data.userId;

    // 1. Queue Join
    socket.on('queue:join', async () => {
      if (userRoom.has(userId)) {
        socket.emit('battle:error', { message: 'You are already in an active battle' });
        return;
      }

      // Ek user ki ek hi entry (dusre tab se join kare to purani hata do)
      battleQueue = battleQueue.filter((p) => p.userId !== userId);
      battleQueue.push({ userId, socketId: socket.id });

      while (battleQueue.length >= 2) {
        const player1 = battleQueue.shift();
        const player2 = battleQueue.shift();
        try {
          await createMatch(player1, player2);
        } catch (err) {
          console.error('[battleSocket] createMatch error:', err.message);
          for (const p of [player1, player2]) {
            battleNsp.to(p.socketId).emit('battle:error', { message: 'Could not start battle' });
          }
        }
      }
    });

    // 2. Queue Leave
    socket.on('queue:leave', () => {
      battleQueue = battleQueue.filter((p) => p.socketId !== socket.id);
    });

    // 3. Progress Updates (sirf display ke liye)
    socket.on('battle:code_progress', ({ roomId, codeLines } = {}) => {
      const room = getPlayerRoom(socket, roomId);
      if (!room || room.status !== 'active') return;
      const lines = Math.max(0, Number(codeLines) || 0);
      room.players[userId].codeLines = lines;
      socket.to(roomId).emit('battle:opponent_progress', { codeLines: lines });
    });

    // 4. Visible test run ka result opponent ko dikhao (sirf display; winner isse decide nahi hota)
    socket.on('battle:test_update', ({ roomId, passed, total } = {}) => {
      const room = getPlayerRoom(socket, roomId);
      if (!room || room.status !== 'active') return;
      socket.to(roomId).emit('battle:opponent_test_update', {
        passed: Math.max(0, Number(passed) || 0),
        total: Math.max(0, Number(total) || 0),
      });
    });

    // 5. Final Submission — server khud hidden test cases pe judge karta hai
    socket.on('battle:submit_final', async ({ roomId, code, language } = {}) => {
      const room = getPlayerRoom(socket, roomId);
      if (!room || room.status !== 'active') return;

      const player = room.players[userId];
      if (player.judging) return; // ek time pe ek hi submission

      const languageId = getLanguageById(language === 'cpp' ? 'c++' : language);
      if (typeof code !== 'string' || !code.trim() || !languageId) {
        socket.emit('battle:error', { message: 'Invalid code or language' });
        return;
      }

      player.judging = true;
      try {
        const problem = await Problem.findById(room.problemId).select('hiddenTestCases');
        const testResult = await runTestCases(code, languageId, problem.hiddenTestCases);
        const { testCasesPassed, status, errorMessage } = summarizeResults(testResult);

        player.passed = Math.max(player.passed, testCasesPassed);
        const total = testResult.length;

        socket.emit('battle:submit_result', { passed: testCasesPassed, total, status, error: errorMessage });
        socket.to(roomId).emit('battle:opponent_test_update', { passed: testCasesPassed, total });

        if (status === 'accepted') {
          endBattle(room, userId, 'solved');
        }
      } catch (err) {
        console.error('[battleSocket] submit_final error:', err.message);
        socket.emit('battle:error', { message: 'Could not judge submission, try again' });
      } finally {
        player.judging = false;
      }
    });

    // 6. Refresh/reconnect ke baad room me wapas aana
    socket.on('battle:rejoin_room', ({ roomId } = {}) => {
      const room = getPlayerRoom(socket, roomId);
      if (!room || room.status !== 'active') {
        socket.emit('battle:rejoin_failed');
        return;
      }

      const player = room.players[userId];
      clearTimeout(player.graceTimer);
      player.graceTimer = null;
      player.socketId = socket.id;
      socket.join(roomId);

      socket.emit('battle:state_sync', snapshotFor(room, userId));
      socket.to(roomId).emit('battle:opponent_reconnected');
    });

    // 7. Disconnect — sirf opponent ko batao, grace period ke baad forfeit
    socket.on('disconnect', () => {
      battleQueue = battleQueue.filter((p) => p.socketId !== socket.id);

      const roomId = userRoom.get(userId);
      const room = roomId && rooms.get(roomId);
      if (!room || room.status !== 'active') return;

      const player = room.players[userId];
      if (player.socketId !== socket.id) return; // purana socket tha, user naye se already connected hai

      socket.to(roomId).emit('battle:opponent_disconnected');

      player.graceTimer = setTimeout(() => {
        const opponentId = room.playerIds.find((id) => id !== userId);
        endBattle(room, opponentId, 'opponent_disconnected');
      }, RECONNECT_GRACE_MS);
    });
  });
}

module.exports = registerBattleNamespace;
