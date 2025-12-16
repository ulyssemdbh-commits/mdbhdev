import { Server as SocketServer } from "socket.io";
import type { Server } from "http";

let io: SocketServer | null = null;

export function initializeSocket(httpServer: Server) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Socket client connected:", socket.id);

    socket.on("join-role", (role: string) => {
      socket.join(role);
      console.log(`Socket ${socket.id} joined room: ${role}`);
    });

    socket.on("disconnect", () => {
      console.log("Socket client disconnected:", socket.id);
    });
  });

  return io;
}

export function emitTransactionUpdate(transaction: any) {
  if (io) {
    io.to("admin").emit("transaction-update", transaction);
    io.to("merchant").emit("transaction-update", transaction);
  }
}

export function emitCashbackUpdate(data: any) {
  if (io) {
    io.to("admin").emit("cashback-update", data);
  }
}

export function emitStatsUpdate() {
  if (io) {
    io.to("admin").emit("stats-refresh");
  }
}

export function emitMerchantUpdate() {
  if (io) {
    io.to("admin").emit("merchant-update");
    io.to("merchant").emit("merchant-update");
    io.to("client").emit("merchant-update");
  }
}

export function emitClientUpdate() {
  if (io) {
    io.to("admin").emit("client-update");
    io.to("client").emit("client-update");
  }
}

export function getIO() {
  return io;
}
