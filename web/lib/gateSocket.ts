import { io } from "socket.io-client";

export const queueSocket = io(
  `${process.env.NEXT_PUBLIC_BACKEND_URL}/queue`,
  {
    autoConnect: false,
  },
);