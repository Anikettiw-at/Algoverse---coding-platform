import { io } from 'socket.io-client';

// Production me VITE_SOCKET_URL / VITE_API_URL se backend URL aata hai, warna localhost
const BACKEND_URL =
  import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';

const socketOptions = {
  autoConnect: false,
  withCredentials: true, // JWT Cookie bhejne ke liye required hai
  transports: ['websocket', 'polling'],
};

let battleSocket = null;
let collabSocket = null;

export const getBattleSocket = () => {
  if (!battleSocket) {
    // ⚠️ IMPORTANT: '/battle' namespace attach karna zaroori hai
    battleSocket = io(`${BACKEND_URL}/battle`, socketOptions);
  }
  return battleSocket;
};

export const disconnectBattleSocket = () => {
  if (battleSocket) {
    battleSocket.disconnect();
    battleSocket = null;
  }
};

export const getCollabSocket = () => {
  if (!collabSocket) {
    collabSocket = io(`${BACKEND_URL}/collab`, socketOptions);
  }
  return collabSocket;
};

export const disconnectCollabSocket = () => {
  if (collabSocket) {
    collabSocket.disconnect();
    collabSocket = null;
  }
};

// Logout pe dono sockets band karo (warna purane user ka connection zinda rehta hai)
export const disconnectAllSockets = () => {
  disconnectBattleSocket();
  disconnectCollabSocket();
};
