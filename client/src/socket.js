import { io } from 'socket.io-client';

const URL = 'https://ayliozi-game-server.onrender.com/';

export const socket = io(URL);