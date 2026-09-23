# Players are identified by their name alone

A Player is whoever joins with a given name (case-insensitive): no account, token or cookie. Rejoining with the
same name, after a dropped connection, a reloaded page or a different phone, resumes the same Player with their
score and in-progress state. We chose this for zero-friction play in one room, where phones sleep, browsers get
closed and people swap devices mid-game; any stored credential would lock people out of their own score. The cost
is that anyone can take over a Player by typing their name. When the same name joins from a second live device,
that device takes the slot and the first device is sent back to the join screen (one device per Player).
