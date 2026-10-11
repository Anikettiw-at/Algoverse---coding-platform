/**
 * store/battleSlice.js
 *
 * Battle namespace ke socket events isi slice ke actions dispatch karte
 * hain (CodeBattle.jsx me socket listeners wire hote hain). Ye slice
 * khud koi socket call nahi karta — sirf state hold karta hai, taaki
 * testable/predictable rahe.
 */
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  status: 'idle', // idle | queueing | matched | ended
  roomId: null,
  problem: null, // { id, title, difficulty, totalTestCases }
  duration: 0, // ms
  startTime: null, // epoch ms, server se aata hai
  opponent: null, // { userId }
  myProgress: { codeLines: 0, passed: 0, total: 0 },
  opponentProgress: { codeLines: 0, passed: 0, total: 0 },
  opponentConnectionStatus: 'connected', // connected | disconnected
  winnerId: null, // null = draw/pending
  endReason: null, // 'solved' | 'timeout' | 'opponent_disconnected'
  error: null,
};

const battleSlice = createSlice({
  name: 'battle',
  initialState,
  reducers: {
    startQueueing(state) {
      state.status = 'queueing';
      state.error = null;
    },
    stopQueueing(state) {
      if (state.status === 'queueing') state.status = 'idle';
    },
    matchFound(state, action) {
      const { roomId, problem, duration, startTime, opponent } = action.payload;
      state.status = 'matched';
      state.roomId = roomId;
      state.problem = problem;
      state.duration = duration;
      state.startTime = startTime;
      state.opponent = opponent;
      state.myProgress = { codeLines: 0, passed: 0, total: problem?.totalTestCases ?? 0 };
      state.opponentProgress = { codeLines: 0, passed: 0, total: problem?.totalTestCases ?? 0 };
      state.opponentConnectionStatus = 'connected';
      state.winnerId = null;
      state.endReason = null;
    },
    updateMyCodeLines(state, action) {
      state.myProgress.codeLines = action.payload;
    },
    updateMyTestResult(state, action) {
      state.myProgress.passed = action.payload.passed;
      state.myProgress.total = action.payload.total;
    },
    updateOpponentProgress(state, action) {
      state.opponentProgress = { ...state.opponentProgress, ...action.payload };
    },
    opponentDisconnected(state) {
      state.opponentConnectionStatus = 'disconnected';
    },
    opponentReconnected(state) {
      state.opponentConnectionStatus = 'connected';
    },
    battleEnded(state, action) {
      state.status = 'ended';
      state.winnerId = action.payload.winnerId;
      state.endReason = action.payload.reason;
    },
    // Reconnect-after-refresh case: server 'battle:state_sync' se poori state milti hai
    battleStateSync(state, action) {
      const { me, opponentState, roomId, problem, startTime, duration, opponent, status, winnerId, endReason } =
        action.payload;
      // Refresh ke baad Redux state khaali hoti hai — server se poora battle context wapas bharo
      state.status = status === 'ended' ? 'ended' : 'matched';
      if (roomId) state.roomId = roomId;
      if (problem) state.problem = problem;
      if (startTime) state.startTime = startTime;
      if (duration) state.duration = duration;
      if (opponent) state.opponent = opponent;
      state.winnerId = winnerId ?? null;
      state.endReason = endReason ?? null;
      state.myProgress = {
        codeLines: Number(me?.codeLines ?? 0),
        passed: Number(me?.passed ?? 0),
        total: Number(me?.total ?? 0),
      };
      state.opponentProgress = {
        codeLines: Number(opponentState?.codeLines ?? 0),
        passed: Number(opponentState?.passed ?? 0),
        total: Number(opponentState?.total ?? 0),
      };
      state.opponentConnectionStatus = 'connected';
    },
    setBattleError(state, action) {
      state.error = action.payload;
    },
    resetBattle() {
      return initialState;
    },
  },
});

export const {
  startQueueing,
  stopQueueing,
  matchFound,
  updateMyCodeLines,
  updateMyTestResult,
  updateOpponentProgress,
  opponentDisconnected,
  opponentReconnected,
  battleEnded,
  battleStateSync,
  setBattleError,
  resetBattle,
} = battleSlice.actions;

export default battleSlice.reducer;