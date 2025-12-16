import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { queryClient } from "@/lib/queryClient";

export function useSocket(role: string) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      socket.emit("join-role", role);
    });

    socket.on("stats-refresh", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/merchants"] });
    });

    socket.on("transaction-update", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
    });

    socket.on("cashback-update", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashback"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    });

    socket.on("merchant-update", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/merchants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/merchants"] });
    });

    socket.on("client-update", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    return () => {
      socket.disconnect();
    };
  }, [role]);

  return socketRef;
}
