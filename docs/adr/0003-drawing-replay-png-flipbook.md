# Drawing replay is a PNG snapshot flipbook, not recorded vector strokes

The Reveal replays how each Drawing was made. We record full-resolution PNG snapshots of the canvas (one every
~0.9s while it changes) and play them back as a flipbook. An earlier version recorded vector strokes (points,
colour, size, erase, clear) and re-drew them, which is far smaller but did not reproduce reliably across phones;
the canvas's own PNG export is the capture path that behaves the same on every device, and it covers flood fill
and undo with no extra work. To bound the size we keep at most 40 frames per Drawing on both client and server
(thinning older frames evenly), and frames travel only with the submit and the final Draft, never the 2s heartbeat.
