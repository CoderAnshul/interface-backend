import http from "http";
import { Server } from "socket.io";
import app from "./app.js"; // your Express app
import dotenv from "dotenv";
import videoSocketHandler from "./sockets/videoSocketHandler.js";
import chatSocketHandler from "./sockets/chatSocketHandler.js";

dotenv.config();

// Create HTTP server (required for Socket.io)
const server = http.createServer(app);

// Setup Socket.io server
const io = new Server(server, {
  cors: {
    origin: [
      "https://your-frontend.vercel.app", // ✅ Vercel frontend (replace with your actual domain)
      "http://localhost:3000", // ✅ Local development
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket"], // recommended to avoid fallback polling
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
});

io.use((socket, next) => {
  //console.log("Handshake token:", socket.handshake.auth);
  next();
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication error: No token"));

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET_KEY);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    return next(new Error("Authentication error: Invalid token"));
  }
});

// Socket event listener
io.on("connection", (socket) => {
  //console.log(`✅ Socket connected: ${socket.id}`);
  //   videoSocketHandler(socket); // your custom socket event handlers
  chatSocketHandler(socket, io);
});

// Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  //console.log(`🚀 Server + Socket.io running on port ${PORT}`);
});
