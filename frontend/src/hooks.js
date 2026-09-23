import { useCallback, useEffect, useRef, useState } from 'react';

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

// State that belongs to one server step (e.g. `${gameId}:${promptIndex}`) and resets by
// itself when the key changes — derived, not via a reset effect, so a private message that
// arrives right after a `state` broadcast can't be wiped by a late-running effect.
// update(patch, forKey?) merges an object patch into an object value (or replaces a plain
// value, or applies a function) for `forKey` (default: the current key).
// Pass forKey when the message carries its own tag (e.g. fibbage:sync) so it lands on the
// right step even if React hasn't rendered the new `state` yet.
export function useKeyedState(key, initial) {
  const [st, setSt] = useState({ key, value: initial });
  const keyRef = useRef(key);
  keyRef.current = key;
  const initialRef = useRef(initial);
  const value = st.key === key ? st.value : initial;
  const update = useCallback((patch, forKey = keyRef.current) => {
    setSt((prev) => {
      const base = prev.key === forKey ? prev.value : initialRef.current;
      const merge = isPlainObject(base) && isPlainObject(patch);
      const next = typeof patch === 'function' ? patch(base) : merge ? { ...base, ...patch } : patch;
      return { key: forKey, value: next };
    });
  }, []);
  return [value, update];
}

// Lifecycle of one timed player input (a gartic round, a fibbage answer or vote):
//  - `submitted` / `lockedOut` reset per `step` (the server's step tag)
//  - while open, `draft(false)` runs every 2s (heartbeat) so in-progress work survives
//    the host advancing without a submit
//  - when the timer hits 0, one final `draft(true)` is sent WHILE the input is still
//    mounted, then input locks. Don't replace this with a "submit on timeUp" — it races
//    the host's instant Next and the canvas unmounts before capture.
// draft may be null (vote phases have nothing to autosave).
export function usePhaseInput({ step, active, timeUp, draft = null, heartbeatMs = 2000 }) {
  const [s, update] = useKeyedState(step, { submitted: false, lockedOut: false });
  const open = !!active && !s.submitted && !s.lockedOut;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (!open || !draftRef.current) return undefined;
    const id = setInterval(() => draftRef.current?.(false), heartbeatMs);
    return () => clearInterval(id);
  }, [open, step, heartbeatMs]);

  useEffect(() => {
    if (!timeUp || !open) return;
    draftRef.current?.(true);
    update({ lockedOut: true }, step);
  }, [timeUp, open, step, update]);

  const markSubmitted = useCallback((forStep) => update({ submitted: true }, forStep), [update]);
  return { submitted: s.submitted, lockedOut: s.lockedOut, open, markSubmitted };
}
