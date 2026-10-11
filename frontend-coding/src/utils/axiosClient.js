import axios from "axios";

// 🌟 DYNAMIC BASE URL SETUP
// 1. Agar .env me VITE_API_URL defined hai (Production/Vercel/Render pe), toh wo use karega.
// 2. Agar .env me VITE_API_URL nahi hai ya empty hai, toh fallback karke 'http://localhost:3000' lega.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const axiosClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

export default axiosClient;