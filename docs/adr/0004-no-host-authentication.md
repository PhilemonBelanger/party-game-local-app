# No Host authentication: the local network is trusted

Any device on the Wi-Fi can send Host commands (start, next, reveal, reset, switch Mode, load a Quiz). The game is
built for a home network where everyone in the room is playing together, and a Host PIN or token would add a setup
step and break the "open the page on the TV and go" flow; a mischievous player could already take over any Player
by name ([ADR-0002](0002-players-identified-by-name.md)). Revisit this if the game is ever played on a shared or
public network. The natural fix then is a short code shown on the Host screen that Host commands must carry.
