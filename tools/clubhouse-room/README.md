# Clubhouse room pictures

The Workshop Lab's clubhouse try-out shows the whole pool as one bright room, drawn in 3D and shown as a picture: by day, at night
(the pool lit outside), and each again from Dec 7 with the Bowl Pool's bulletin board wheeled in. The pictures are
`public/lab/clubhouse/room-{day,night}[-bowl].webp`; where each thing sits in them (the page lays a tap spot over each) is
`src/lib/lab-clubhouse-room.json`. Both are made here. Nothing in this folder is part of the app build, and the app never runs it.

The room uses the real trophy models, so it borrows the trophy renderer's modules and its three.js install
(`tools/trophy-render`, see its README).

## Re-rendering

1. Once: `cd tools/trophy-render && npm install`.
2. From this folder: `node render.mjs` (about two minutes, software rendering, no graphics card needed). `PNG=1` also writes PNGs,
   and `node render.mjs <folder>` writes to another folder for design work.
3. Commit the changed pictures and `src/lib/lab-clubhouse-room.json`, re-record the Lab screenshots (the visual-baselines workflow),
   and open a pull request.

## Files

- `room.js`: the room (the thatched ceiling and fans, the glass wall and the pool patio, the Big Board and sportsbook, the bar, the
  stone chimney with the TV, the lounge with the race table, the trophies, the poker table, the Bowl Pool board) and the camera.
- `render.mjs`: renders the four pictures and writes the tap spots. `shot.mjs`: design work, renders chosen views large to a folder
  (for example `node shot.mjs out '[["day","scale=3"],["night","scale=3&night=1"]]'`). `scene.html`, `serve.mjs`: the page and static server it drives.
