import { io } from "socket.io-client";

export const gateSocket = io(
  `${process.env.NEXT_PUBLIC_BACKEND_URL}/gate`,
  {
    autoConnect: false,
  },
);