const express = require('express');
const http = require('http'); // 🌟 Socket.io support ke liye HTTP server
const path = require('path');

// 🌟 Explicitly load .env from root directory
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const main = require('./config/db');
const cookieParser = require('cookie-parser');
const authRouter = require("./routes/userAuth");
const redisClient = require('./config/redis');
const problemRouter = require("./routes/problemCreator");
const submitRouter = require("./routes/submit");
const aiRouter = require("./routes/aiChatting");
const videoRouter = require("./routes/videoCreator");
const cors = require('cors');

// 🌟 Socket Handler Import
const { initSocket } = require('./sockets/socketHandler');

const app = express();

// 🌟 Express app ko HTTP server se wrap kiya
const server = http.createServer(app);

// 🌟 Socket.io attach kiya
initSocket(server);

const { allowedOrigins } = require('./config/origins');

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.use('/user', authRouter);
app.use('/problem', problemRouter);
app.use('/submission', submitRouter);
app.use('/ai', aiRouter);
app.use("/video", videoRouter);

const InitializeConnection = async () => {
  try {
    // Redis connection safety check
    const connectRedis = async () => {
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
    };

    // Parallel DB and Redis initialization
    await Promise.all([main(), connectRedis()]);
    console.log("✅ DB and Redis Connected Successfully");

    const PORT = process.env.PORT || 3000;

    // 🌟 app.listen(...) ko badal kar server.listen(...) kar diya
    server.listen(PORT, () => {
      console.log(`🚀 Server listening at port number: ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Initialization Error:", err.message || err);
    process.exit(1); // DB/Redis ke bina server chalana bekaar hai
  }
};

InitializeConnection();