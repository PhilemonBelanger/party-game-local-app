import { io } from 'socket.io-client';
import { BACKEND_ORIGIN } from './config';

// Dev: connect to the backend on :3001. Production: same-origin (single server).
export const socket = BACKEND_ORIGIN ? io(BACKEND_ORIGIN) : io();
