/**
 * pages/CodeBattle.jsx
 *
 * Battle namespace (/battle) ka main UI. Flow:
 *   idle -> "Find Match" click -> queueing -> match_found -> matched (live battle) -> ended
 *
 * Opponent ka actual code kabhi nahi dikhta — sirf uska progress
 * (line count, tests passed) "live terminal" style log me dikhta hai.
 *
 * Run Tests  -> REST /submission/run/:problemId (visible test cases, sirf practice)
 * Submit     -> socket 'battle:submit_final' (server hidden test cases pe judge karke
 *               winner khud decide karta hai)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Editor } from '@monaco-editor/react';
import { getBattleSocket } from '../utils/socket';
import axiosClient from '../utils/axiosClient';
import { NavLink } from 'react-router';
import { Swords, Timer, Activity, Trophy, ArrowLeft, Play, Send } from 'lucide-react';
import Navbar from '../components/Navbar';
import {
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
} from '../store/battleSlice';

const ROOM_STORAGE_KEY = 'algoverse_active_battle_room';
const PROGRESS_EMIT_THROTTLE_MS = 600;
const LOBBY_FEATURES = [
  { icon: Timer, title: '15 minutes', text: 'Same problem, same clock for both players.' },
  { icon: Activity, title: 'Live progress', text: 'See how many lines and tests your opponent has.' },
  { icon: Trophy, title: 'Server judged', text: 'Hidden test cases decide the winner.' },
];
const DEFAULT_CODE = '// Problem padho aur yahan code likho\n';

// Problem.startCode me language names 'C++' / 'Java' / 'JavaScript' store hote hain
const LANGUAGE_LABELS = { cpp: 'C++', java: 'Java', javascript: 'JavaScript' };

function getStarterCode(problem, language) {
  const starter = problem?.startCode?.find((sc) => sc.language === LANGUAGE_LABELS[language]);
  return starter?.initialCode ?? DEFAULT_CODE;
}

function endReasonText(reason) {
  switch (reason) {
    case 'solved': return 'saare hidden test cases pass';
    case 'timeout': return 'time khatam';
    case 'opponent_disconnected': return 'opponent disconnect ho gaya';
    default: return reason ?? '';
  }
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function CodeBattle() {
  const dispatch = useDispatch();
  const battle = useSelector((state) => state.battle);
  const currentUser = useSelector((state) => state.auth?.user); // apne authSlice ke shape ke hisaab se adjust kar lena

  const [code, setCode] = useState(DEFAULT_CODE);
  const [language, setLanguage] = useState('cpp');
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [terminalLog, setTerminalLog] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const socketRef = useRef(null);
  const progressThrottleRef = useRef(null);
  const battleRef = useRef(battle); // interval callbacks ke andar latest state chahiye hoti hai
  battleRef.current = battle;
  const languageRef = useRef(language);
  languageRef.current = language;

  const appendLog = useCallback((line) => {
    setTerminalLog((prev) => [...prev.slice(-49), { text: line, at: Date.now() }]);
  }, []);

  // -----------------------------------------------------------------------
  // Socket lifecycle + event wiring
  // -----------------------------------------------------------------------
  useEffect(() => {
    const socket = getBattleSocket();
    socketRef.current = socket;
    if (!socket.connected) socket.connect();

    function handleMatchFound(payload) {
      dispatch(matchFound(payload));
      localStorage.setItem(ROOM_STORAGE_KEY, payload.roomId);
      setCode(getStarterCode(payload.problem, languageRef.current));
      setTerminalLog([]);
      appendLog(`Match mil gaya! Opponent: ${payload.opponent?.userId ?? 'unknown'}`);
    }

    function handleOpponentProgress({ codeLines }) {
      dispatch(updateOpponentProgress({ codeLines }));
      appendLog(`Opponent ne likha: ${codeLines} lines`);
    }

    function handleOpponentTestUpdate({ passed, total }) {
      dispatch(updateOpponentProgress({ passed, total }));
      appendLog(`Opponent: ${passed}/${total} test cases passed`);
    }

    function handleBattleEnded({ winnerId, reason }) {
      dispatch(battleEnded({ winnerId, reason }));
      localStorage.removeItem(ROOM_STORAGE_KEY);
      const iWon = winnerId && currentUser && winnerId === currentUser._id;
      appendLog(
        winnerId
          ? iWon
            ? '🏆 Tum jeet gaye!'
            : '😔 Opponent jeet gaya.'
          : '🤝 Match draw raha (dono ke tests barabar).'
      );
    }

    function handleOpponentDisconnected() {
      dispatch(opponentDisconnected());
      appendLog('⚠️ Opponent disconnect ho gaya — reconnect ka wait ho raha hai...');
    }

    function handleOpponentReconnected() {
      dispatch(opponentReconnected());
      appendLog('✅ Opponent wapas connect ho gaya.');
    }

    function handleStateSync(payload) {
      dispatch(battleStateSync(payload));
      setCode((prev) => (prev === DEFAULT_CODE ? getStarterCode(payload.problem, languageRef.current) : prev));
      appendLog('🔄 Battle me wapas jud gaye.');
    }

    function handleRejoinFailed() {
      localStorage.removeItem(ROOM_STORAGE_KEY);
      dispatch(resetBattle());
    }

    function handleSubmitResult({ passed, total, status, error }) {
      setIsRunning(false);
      dispatch(updateMyTestResult({ passed, total }));
      appendLog(
        status === 'accepted'
          ? `✅ Submit: ${passed}/${total} hidden test cases passed`
          : `❌ Submit: ${passed}/${total} hidden test cases passed${error ? ` — ${error}` : ''}`
      );
    }

    function handleError({ message }) {
      setIsRunning(false);
      dispatch(setBattleError(message));
      appendLog(`❌ Error: ${message}`);
    }

    function handleConnectError(err) {
      dispatch(setBattleError(`Connection failed: ${err.message}`));
    }

    socket.on('match_found', handleMatchFound);
    socket.on('battle:opponent_progress', handleOpponentProgress);
    socket.on('battle:opponent_test_update', handleOpponentTestUpdate);
    socket.on('battle:ended', handleBattleEnded);
    socket.on('battle:opponent_disconnected', handleOpponentDisconnected);
    socket.on('battle:opponent_reconnected', handleOpponentReconnected);
    socket.on('battle:state_sync', handleStateSync);
    socket.on('battle:error', handleError);
    socket.on('battle:submit_result', handleSubmitResult);
    socket.on('battle:rejoin_failed', handleRejoinFailed);
    socket.on('connect_error', handleConnectError);

    // Refresh ke baad agar koi active room tha, to rejoin try karo
    const savedRoomId = localStorage.getItem(ROOM_STORAGE_KEY);
    if (savedRoomId) {
      socket.emit('battle:rejoin_room', { roomId: savedRoomId });
    }

    return () => {
      socket.off('match_found', handleMatchFound);
      socket.off('battle:opponent_progress', handleOpponentProgress);
      socket.off('battle:opponent_test_update', handleOpponentTestUpdate);
      socket.off('battle:ended', handleBattleEnded);
      socket.off('battle:opponent_disconnected', handleOpponentDisconnected);
      socket.off('battle:opponent_reconnected', handleOpponentReconnected);
      socket.off('battle:state_sync', handleStateSync);
      socket.off('battle:error', handleError);
      socket.off('battle:submit_result', handleSubmitResult);
      socket.off('battle:rejoin_failed', handleRejoinFailed);
      socket.off('connect_error', handleConnectError);
      // Note: disconnectBattleSocket() yahan jaan-boojh kar NAHI bulaya —
      // agar user sirf tab switch/navigate kar raha hai to socket zinda
      // rehna chahiye taaki battle chalti rahe. App-level logout pe
      // disconnectAllSockets() ko explicitly call karna (authSlice ka logoutUser karta hai).
    };
  }, [dispatch, currentUser, appendLog]);

  // -----------------------------------------------------------------------
  // Countdown timer — server ke startTime + duration se calculate hota hai
  // (client apna khud ka timer authoritative nahi maanta, sirf display ke liye)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (battle.status !== 'matched' || !battle.startTime || !battle.duration) return;

    const tick = () => {
      const elapsed = Date.now() - battle.startTime;
      const remaining = battle.duration - elapsed;
      setTimeLeftMs(remaining);
    };
    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [battle.status, battle.startTime, battle.duration]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------
  const handleFindMatch = () => {
    dispatch(startQueueing());
    socketRef.current?.emit('queue:join', {});
  };

  const handleCancelQueue = () => {
    dispatch(stopQueueing());
    socketRef.current?.emit('queue:leave');
  };

  const handleEditorChange = (value) => {
    setCode(value ?? '');
    const lineCount = (value ?? '').split('\n').length;
    dispatch(updateMyCodeLines(lineCount));

    // Har keystroke pe emit nahi karna — throttle laga do
    if (progressThrottleRef.current) return;
    progressThrottleRef.current = setTimeout(() => {
      progressThrottleRef.current = null;
      socketRef.current?.emit('battle:code_progress', {
        roomId: battleRef.current.roomId,
        codeLines: lineCount,
      });
    }, PROGRESS_EMIT_THROTTLE_MS);
  };

  const handleLanguageChange = (newLanguage) => {
    // Agar user ne abhi tak kuch nahi likha to naye language ka starter code daal do
    if (code === getStarterCode(battle.problem, language) || code === DEFAULT_CODE) {
      setCode(getStarterCode(battle.problem, newLanguage));
    }
    setLanguage(newLanguage);
  };

  // Visible test cases pe practice run (REST)
  const runTests = async () => {
    if (!battle.roomId || !battle.problem?.id) return;
    setIsRunning(true);
    try {
      const { data } = await axiosClient.post(`/submission/run/${battle.problem.id}`, {
        code,
        language,
      });
      const passed = data.passedTestCases ?? 0;
      const total = data.totalTestCases ?? 0;

      appendLog(`Run: ${passed}/${total} sample test cases passed${data.error ? ` — ${data.error}` : ''}`);
      socketRef.current?.emit('battle:test_update', { roomId: battle.roomId, passed, total });
    } catch (err) {
      const message = typeof err.response?.data === 'string' ? err.response.data : err.message;
      appendLog(`❌ Run fail: ${message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Final submit: code server ko jaata hai, server hidden tests pe judge karta hai
  const submitFinal = () => {
    if (!battle.roomId) return;
    setIsRunning(true);
    appendLog('⏳ Submit kiya — hidden test cases chal rahe hain...');
    socketRef.current?.emit('battle:submit_final', { roomId: battle.roomId, code, language });
  };

  const handlePlayAgain = () => {
    localStorage.removeItem(ROOM_STORAGE_KEY);
    setCode(DEFAULT_CODE);
    setTerminalLog([]);
    dispatch(resetBattle());
  };

  // -----------------------------------------------------------------------
  // Render: status ke hisaab se alag screens
  // -----------------------------------------------------------------------
  if (battle.status === 'idle' || battle.status === 'queueing') {
    return (
      <div className="min-h-screen bg-grid">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 sm:px-6 py-16 text-center fade-up">
          <span className="inline-grid place-items-center w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-secondary shadow-xl shadow-primary/30">
            <Swords size={40} className="text-white" />
          </span>
          <h1 className="mt-6 text-4xl sm:text-5xl font-extrabold tracking-tight">
            1v1 <span className="text-gradient">Code Battle</span>
          </h1>
          <p className="mt-4 text-base-content/60 max-w-xl mx-auto">
            Get matched with another coder, solve the same problem against the clock, and watch their progress live.
            First to pass every hidden test case wins.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3 text-left">
            {LOBBY_FEATURES.map((feature) => {
              const { icon: Icon, title, text } = feature;
              return (
              <div key={title} className="glass-panel rounded-2xl p-5">
                <Icon size={20} className="text-accent" />
                <p className="mt-3 font-semibold">{title}</p>
                <p className="mt-1 text-sm text-base-content/60">{text}</p>
              </div>
            );
            })}
          </div>

          <div className="mt-10">
            {battle.status === 'idle' ? (
              <button onClick={handleFindMatch} className="btn-gradient btn-lg px-10">
                <Swords size={20} /> Find a match
              </button>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-3 text-lg font-medium">
                  <span className="loading loading-ring loading-lg text-primary" />
                  Looking for an opponent...
                </div>
                <button onClick={handleCancelQueue} className="btn btn-ghost btn-sm border border-base-content/15">
                  Cancel
                </button>
              </div>
            )}
            {battle.error && (
              <div role="alert" className="alert alert-error alert-soft mt-6 max-w-md mx-auto">
                {battle.error}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  const isLowTime = battle.status === 'matched' && timeLeftMs < 60_000;

  return (
    <div className="flex flex-col h-screen bg-base-200">
      {/* Top bar: timer + status */}
      <div className="h-14 shrink-0 flex items-center justify-between gap-4 px-4 border-b border-base-content/10 bg-base-100">
        <div className="flex items-center gap-3 min-w-0">
          <NavLink to="/" className="btn btn-ghost btn-sm btn-square" aria-label="Back to problems"><ArrowLeft size={18} /></NavLink>
          <Swords size={18} className="text-primary shrink-0" />
          <h2 className="font-semibold truncate max-w-xs">{battle.problem?.title ?? 'Problem'}</h2>
        </div>
        <div className={`px-3 py-1 rounded-lg bg-base-200 text-xl font-mono tabular-nums ${isLowTime ? 'text-error animate-pulse' : 'text-success'}`}>
          {battle.status === 'ended' ? '--:--' : formatTime(timeLeftMs)}
        </div>
        <span className={`badge badge-soft capitalize ${battle.problem?.difficulty === 'easy' ? 'badge-success' : battle.problem?.difficulty === 'medium' ? 'badge-warning' : 'badge-error'}`}>
          {battle.problem?.difficulty ?? ''}
        </span>
      </div>

      {battle.status === 'ended' && (
        <div className="p-3 bg-primary/10 border-b border-primary/20 text-center font-medium flex items-center justify-center gap-2 flex-wrap">
          {battle.winnerId
            ? battle.winnerId === currentUser?._id
              ? '🏆 Tum jeet gaye!'
              : '😔 Opponent jeet gaya.'
            : '🤝 Match draw raha.'}{' '}
          <span className="text-sm">({endReasonText(battle.endReason)})</span>
          <button onClick={handlePlayAgain} className="btn btn-primary btn-sm ml-2">
            Play Again
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left: problem statement */}
        <div className="w-1/4 overflow-y-auto scroll-thin p-5 border-r border-base-content/10 bg-base-100">
          <h3 className="font-semibold mb-2">Problem Statement</h3>
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-base-content/80">
            {battle.problem?.description ?? 'Description load ho rahi hai...'}
          </p>
        </div>

        {/* Middle: my editor */}
        <div className="w-1/2 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 bg-base-100 border-b border-base-content/10">
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="select select-sm w-auto"
            >
              <option value="cpp">C++</option>
              <option value="java">Java</option>
              <option value="javascript">JavaScript</option>
            </select>
            <span className="text-xs text-base-content/60 tabular-nums">
              {battle.myProgress.codeLines} lines · {battle.myProgress.passed}/{battle.myProgress.total} passed
            </span>
          </div>
          <div className="flex-1">
            <Editor
              height="100%"
              language={language}
              value={code}
              theme="vs-dark"
              onChange={handleEditorChange}
              options={{ minimap: { enabled: false }, fontSize: 14 }}
            />
          </div>
          <div className="flex justify-end gap-2 p-3 bg-base-100 border-t border-base-content/10">
            <button
              disabled={isRunning || battle.status === 'ended'}
              onClick={runTests}
              className="btn btn-sm btn-ghost border border-base-content/15"
            >
              <Play size={14} /> {isRunning ? 'Running...' : 'Run tests'}
            </button>
            <button
              disabled={isRunning || battle.status === 'ended'}
              onClick={submitFinal}
              className="btn btn-sm btn-success"
            >
              <Send size={14} /> Submit
            </button>
          </div>
        </div>

        {/* Right: opponent status + live terminal */}
        <div className="w-1/4 flex flex-col border-l border-base-content/10 bg-base-100">
          <div className="p-4 border-b border-base-content/10">
            <h3 className="font-semibold text-sm">
              Opponent{' '}
              <span
                className={`inline-block w-2 h-2 rounded-full ml-1 ${
                  battle.opponentConnectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
            </h3>
            <div className="text-xs text-base-content/60 mt-1 tabular-nums">
              {battle.opponentProgress.codeLines} lines · {battle.opponentProgress.passed}/
              {battle.opponentProgress.total} passed
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin p-3 font-mono text-xs bg-base-300/40 text-success space-y-1">
            {terminalLog.map((entry, idx) => (
              <div key={idx}>
                <span className="text-base-content/40">[{new Date(entry.at).toLocaleTimeString()}]</span>{' '}
                {entry.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
