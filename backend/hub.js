// The hub: everything between a socket and a game mode, with no Socket.IO inside.
//
// Owns player identity (players persist across disconnects, keyed by lowercased name),
// the socket→player map, the active mode, and dispatch of client events to that mode.
// server.js is a thin adapter: it forwards connect/event/disconnect here and supplies a
// `transport` that actually emits. Tests supply a recording transport + fake clock.
//
// GameMode interface (trivia.js, gartic.js, fibbage.js all satisfy it):
//   start(connectedKeys)  begin a game (mode validates player count / phase; no-op if not allowed)
//   reset()               back to the mode's lobby (the hub broadcasts afterwards)
//   snapshot()            full public state: { phase, title, gameId, step, players, canAdvance?, timer fields, … }
//   onJoin(key)           a player (re)joined: send private resume/spectator messages
//   events                { 'event:name': ({ key, payload, reply }) => void } mode-specific client events
// Mode factories receive the context built in createHub (see `ctx` below).

import { createCountdown, realClock } from './countdown.js';

export const nameKey = (name) => String(name || '').trim().toLowerCase();

export function createHub({ transport, makeModes, clock = realClock, initialMode = 'trivia' }) {
  const players = new Map(); // nameKey -> { id, name, connected, socketId }
  const socketToKey = new Map(); // socketId -> nameKey
  let modeName = initialMode;
  let gameCounter = 0;

  const snapshot = () => ({ mode: modeName, ...modes[modeName].snapshot() });
  const broadcast = () => transport.toAll('state', snapshot());
  // private message to a player, only if they currently have a live socket
  function send(key, event, payload) {
    const p = players.get(key);
    if (p?.connected && p.socketId) transport.toSocket(p.socketId, event, payload);
  }

  const ctx = {
    getPlayers: () => players,
    send,
    broadcast,
    // one countdown per mode; ticks go out as the lightweight `tick` event (keeps
    // base64 images out of the per-second payload), time-up triggers a full broadcast
    createTimer: () => createCountdown({ clock, onTick: (s) => transport.toAll('tick', s), onTimeUp: broadcast }),
    // unique across modes, so clients can key local state on it
    newGameId: () => ++gameCounter,
  };
  const modes = makeModes(ctx);

  const connectedKeys = () => [...players.values()].filter((p) => p.connected).map((p) => p.id);

  function join(socketId, name) {
    const clean = String(name || '').trim().slice(0, 16) || 'Player';
    const key = nameKey(clean);
    let p = players.get(key);
    if (p) {
      // same name from another live device: that device loses the slot (one socket per player)
      if (p.connected && p.socketId && p.socketId !== socketId) {
        socketToKey.delete(p.socketId);
        transport.toSocket(p.socketId, 'player:replaced', {});
      }
      // reconnect / resume — the mode keeps score, answers, everything
      p.connected = true;
      p.socketId = socketId;
      p.name = clean;
    } else {
      p = { id: key, name: clean, connected: true, socketId };
      players.set(key, p);
    }
    socketToKey.set(socketId, key);
    return key;
  }

  // hub-level events; everything else is looked up in the active mode's `events`
  const core = {
    'host:join': ({ socketId }) => transport.toSocket(socketId, 'state', snapshot()),
    'host:setmode': ({ payload }) => {
      modeName = modes[payload] ? payload : 'trivia';
      for (const m of Object.values(modes)) m.reset();
      broadcast();
    },
    'player:join': ({ socketId, payload, reply }) => {
      const key = join(socketId, payload);
      reply({ id: key });
      broadcast();
      modes[modeName].onJoin(key);
    },
    'host:start': () => modes[modeName].start(connectedKeys()),
    'host:reset': () => {
      modes[modeName].reset();
      broadcast();
    },
  };

  const eventNames = [...new Set([...Object.keys(core), ...Object.values(modes).flatMap((m) => Object.keys(m.events))])];

  function connect(socketId) {
    // send the current snapshot to the freshly connected client
    transport.toSocket(socketId, 'state', snapshot());
  }

  function handle(socketId, event, payload, cb) {
    const reply = typeof cb === 'function' ? cb : () => {};
    const key = socketToKey.get(socketId) ?? null;
    const fn = core[event] || modes[modeName].events[event];
    if (!fn) return reply({ ok: false, reason: 'inactive' }); // event belongs to another mode
    fn({ socketId, key, payload, reply });
  }

  function disconnect(socketId) {
    const key = socketToKey.get(socketId);
    socketToKey.delete(socketId);
    if (!key) return;
    const p = players.get(key);
    // only mark offline if this socket is still the player's active one
    // (a reconnect may have already taken over the slot)
    if (p && p.socketId === socketId) {
      p.connected = false;
      p.socketId = null;
      // broadcast so the host's advance button can enable if the remaining
      // connected players are all done
      broadcast();
    }
  }

  return { connect, handle, disconnect, eventNames, snapshot, players, modes, get mode() { return modeName; } };
}
