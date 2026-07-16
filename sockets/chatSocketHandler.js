// sockets/chatSocketHandler.js - Updated with better error handling
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import ChatRoom from "../models/ChatRoom.js";
import Message from "../models/Message.js";

const chatSocketHandler = (socket, io) => {
  //console.log(`Chat socket connected: ${socket.id}`);

  // Handle authentication with better error handling
  socket.on("authenticate", async (token) => {
    try {
      // Check if token exists
      if (!token) {
        socket.emit("auth_error", "Token required");
        return;
      }

      //console.log("Authenticating socket with token:", token);
      // Verify JWT token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET_KEY);
      } catch (jwtError) {
        //console.log("JWT verification failed:", jwtError.message);
        socket.emit("auth_error", "Invalid token =====>");
        return;
      }

      // Find user in database
      const user = await User.findById(decoded.id);
      if (!user) {
        socket.emit("auth_error", "User not found");
        return;
      }

      // Set socket user data
      socket.userId = user._id.toString();
      socket.userEmail = user.email;
      socket.userName = user.name || user.email;

      // Join user to their personal room for notifications
      socket.join(`user_${socket.userId}`);

      // Join user to all their chat rooms
      const userRooms = await ChatRoom.find({
        participants: socket.userId,
      }).populate('participants', 'name email');

      for (const room of userRooms) {
        socket.join(room._id.toString());
        //console.log(`User ${socket.userId} joined room ${room._id}`);
      }

      // Emit successful authentication
      socket.emit("authenticated", {
        userId: socket.userId,
        userName: socket.userName,
        userEmail: socket.userEmail,
        rooms: userRooms.map((room) => ({
          id: room._id.toString(),
          participants: room.participants
        })),
      });

      //console.log(`User ${user.email} authenticated successfully`);

      // Broadcast user online status
      socket.broadcast.emit("user_online", {
        userId: socket.userId,
        userName: socket.userName,
      });

    } catch (error) {
      console.error("Authentication error:", error);
      socket.emit("auth_error", "Authentication failed");
    }
  });

  // Join a specific chat room
  socket.on("join_room", async (roomId) => {
    try {
      if (!socket.userId) {
        socket.emit("error", "Not authenticated");
        return;
      }

      if (!roomId) {
        socket.emit("error", "Room ID required");
        return;
      }

      // Verify user is participant in the room
      const room = await ChatRoom.findById(roomId);
      if (!room) {
        socket.emit("error", "Room not found");
        return;
      }

      const isParticipant = room.participants.some(
        (participant) => participant.toString() === socket.userId
      );

      if (!isParticipant) {
        socket.emit("error", "Not authorized to join this room");
        return;
      }

      socket.join(roomId);
      //console.log(`User ${socket.userId} joined room ${roomId}`);
      
      socket.emit("room_joined", { roomId });
    } catch (error) {
      console.error("Join room error:", error);
      socket.emit("error", "Failed to join room");
    }
  });

  // Leave a specific chat room
  socket.on("leave_room", (roomId) => {
    try {
      if (roomId) {
        socket.leave(roomId);
        //console.log(`User ${socket.userId} left room ${roomId}`);
        socket.emit("room_left", { roomId });
      }
    } catch (error) {
      console.error("Leave room error:", error);
    }
  });

  // Handle sending messages with better validation
  socket.on("send_message", async (data) => {
    try {
      if (!socket.userId) {
        socket.emit("error", "Not authenticated");
        return;
      }

      const { roomId, receiverId, message, messageType = "text", replyTo } = data;

      // Validate required fields
      if (!roomId || !receiverId || !message) {
        socket.emit("error", "Missing required fields");
        return;
      }

      // Verify the room exists and user is a participant
      const room = await ChatRoom.findById(roomId).populate("participants");
      if (!room) {
        socket.emit("error", "Room not found");
        return;
      }

      const isParticipant = room.participants.some(
        (participant) => participant._id.toString() === socket.userId
      );

      if (!isParticipant) {
        socket.emit("error", "You are not a participant in this room");
        return;
      }

      // Validate replyTo message exists and belongs to this room if provided
      if (replyTo) {
        const replyToMessage = await Message.findOne({ _id: replyTo, chatRoomId: roomId });
        if (!replyToMessage) {
          socket.emit("error", "ReplyTo message not found in this room");
          return;
        }
      }

      // Create the message
      const newMessage = new Message({
        chatRoomId: roomId,
        senderId: socket.userId,
        receiverId,
        message: message.trim(),
        messageType,
        isRead: false,
        replyTo: replyTo || null,
      });

      const savedMessage = await newMessage.save();

      // Populate sender, receiver, and replyTo info
      await savedMessage.populate("senderId", "name email");
      await savedMessage.populate("receiverId", "name email");
      if (savedMessage.replyTo) {
        await savedMessage.populate({
          path: "replyTo",
          select: "message senderId createdAt",
          populate: { path: "senderId", select: "name email" }
        });
      }

      // Update the room's last message
      await ChatRoom.findByIdAndUpdate(roomId, {
        lastMessage: savedMessage._id,
        updatedAt: new Date(),
      });

      // Prepare message data for clients
      const messageData = {
        _id: savedMessage._id,
        chatRoomId: savedMessage.chatRoomId,
        roomId: savedMessage.chatRoomId, // For compatibility with frontend
        sender: {
          _id: savedMessage.senderId._id,
          name: savedMessage.senderId.name,
          email: savedMessage.senderId.email,
        },
        receiver: {
          _id: savedMessage.receiverId._id,
          name: savedMessage.receiverId.name,
          email: savedMessage.receiverId.email,
        },
        message: savedMessage.message,
        messageType: savedMessage.messageType,
        isRead: savedMessage.isRead,
        createdAt: savedMessage.createdAt,
        updatedAt: savedMessage.updatedAt,
        replyTo: savedMessage.replyTo ? {
          _id: savedMessage.replyTo._id,
          message: savedMessage.replyTo.message,
          sender: savedMessage.replyTo.senderId ? {
            _id: savedMessage.replyTo.senderId._id,
            name: savedMessage.replyTo.senderId.name,
            email: savedMessage.replyTo.senderId.email,
          } : null,
          createdAt: savedMessage.replyTo.createdAt,
        } : null,
      };

      // Emit to all users in the room
      io.to(roomId).emit("new_message", messageData);

      // Also emit to receiver's personal room for notifications
      io.to(`user_${receiverId}`).emit("new_notification", {
        type: "message",
        roomId,
        sender: messageData.sender,
        message: savedMessage.message,
        timestamp: savedMessage.createdAt,
      });

      // Confirm message sent to sender
      socket.emit("message_sent", {
        messageId: savedMessage._id,
        roomId,
        timestamp: savedMessage.createdAt
      });

      //console.log(`Message sent in room ${roomId} by user ${socket.userId}`);
    } catch (error) {
      console.error("Send message error:", error);
      socket.emit("error", "Failed to send message");
    }
  });

  // Handle message read status
  socket.on("mark_messages_read", async (data) => {
    try {
      if (!socket.userId) {
        socket.emit("error", "Not authenticated");
        return;
      }

      const { roomId, senderId } = data;

      if (!roomId || !senderId) {
        socket.emit("error", "Room ID and sender ID required");
        return;
      }

      // Update messages as read
      const updateResult = await Message.updateMany(
        {
          chatRoomId: roomId,
          senderId: senderId,
          receiverId: socket.userId,
          isRead: false,
        },
        {
          isRead: true,
          readAt: new Date(),
        }
      );

      // Notify the sender that their messages were read
      if (updateResult.modifiedCount > 0) {
        socket.to(roomId).emit("messages_read", {
          roomId,
          readBy: socket.userId,
          timestamp: new Date(),
          count: updateResult.modifiedCount,
        });

        socket.emit("messages_marked_read", {
          roomId,
          count: updateResult.modifiedCount,
        });
      }

      //console.log(`${updateResult.modifiedCount} messages marked as read in room ${roomId}`);
    } catch (error) {
      console.error("Mark messages read error:", error);
      socket.emit("error", "Failed to mark messages as read");
    }
  });

  // Handle typing indicators
  socket.on("typing_start", (data) => {
    try {
      if (!socket.userId) return;

      const { roomId } = data;
      if (!roomId) return;

      socket.to(roomId).emit("user_typing", {
        userId: socket.userId,
        userName: socket.userName,
        roomId,
      });
    } catch (error) {
      console.error("Typing start error:", error);
    }
  });

  socket.on("typing_stop", (data) => {
    try {
      if (!socket.userId) return;

      const { roomId } = data;
      if (!roomId) return;

      socket.to(roomId).emit("user_stopped_typing", {
        userId: socket.userId,
        roomId,
      });
    } catch (error) {
      console.error("Typing stop error:", error);
    }
  });

  // Handle online/offline status
  socket.on("set_online", () => {
    try {
      if (!socket.userId) return;

      socket.broadcast.emit("user_online", {
        userId: socket.userId,
        userName: socket.userName,
      });
    } catch (error) {
      console.error("Set online error:", error);
    }
  });

  // Handle disconnect
  socket.on("disconnect", (reason) => {
    try {
      if (socket.userId) {
        socket.broadcast.emit("user_offline", {
          userId: socket.userId,
        });
        //console.log(`User ${socket.userId} disconnected: ${reason}`);
      }
      //console.log(`Socket ${socket.id} disconnected: ${reason}`);
    } catch (error) {
      console.error("Disconnect handling error:", error);
    }
  });

  // Handle general errors
  socket.on("error", (error) => {
    console.error(`Socket ${socket.id} error:`, error);
  });

  // Handle connection errors
  socket.on("connect_error", (error) => {
    console.error(`Socket ${socket.id} connection error:`, error);
  });
};

export default chatSocketHandler;