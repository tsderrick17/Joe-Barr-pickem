# Clubhouse room pictures

The Workshop Lab's clubhouse try-out shows the whole pool as one bright room, drawn in 3D and shown as a picture: by day, at night
(the pool lit outside), and each again from Dec 7 with the Bowl Pool's bulletin board wheeled in. The pictures are
`public/lab/clubhouse/room-{day,night}[-bowl].webp`; where each thing sits in them (the page lays a tap spot over each) is
`src/lib/lab-clubhouse-room.json`. Both are made here, with the four corners of each live screen (the Big Board and the spreads board), which the page draws today's news onto. Nothing in this folder is part of the app build, and the app never runs it.

The room borrows the trophy renderer's modules (its materials and helpers) and its three.js install
(`tools/trophy-render`, see its README).

## Re-rendering

1. Once: `cd tools/trophy-render && npm install`.
2. From this folder: `node render.mjs` (about 25 minutes, software rendering, no graphics card needed). `PNG=1` also writes PNGs,
   and `node render.mjs <folder>` writes to another folder for design work.
3. Commit the changed pictures and `src/lib/lab-clubhouse-room.json`, re-record the Lab screenshots (the visual-baselines workflow),
   and open a pull request.

## Files

- `room.js`: the room (the thatch and fans, the glass wall with its open doors and the pool patio, the Big Board and spreads board,
  the bar and its mirrored back bar, the stone fireplace (lit only at night) and the Trophy Room sign, the lounge, the oval
  poker table, the Bowl Pool board), its light (the
  sun, the room's own reflections, contact shadow, glow) and the camera.
- `surfaces.js`: what the room is made of: the drawn surfaces (planks, shiplap, fieldstone, thatch, cane, sky, flame) and the one
  modelled leaf that every fan blade and plant is grown from.
- `render.mjs`: renders the eight pictures (the four tall ones for a phone and the same four wide, `-wide`, for a desktop) and writes the tap spots, and for each picture the moving patches (`room-<view>-fan0.webp`, `-plant2.webp`...: a strip of 16 frames each, the fans turning and the plants swaying, the page plays them over the picture).  `shot.mjs`: design work, renders chosen views to a folder
  (for example `node shot.mjs out '[["day",""],["fan","zoom=2.2,0.5,0.2"],["night","night=1"]]'`; `zoom=k,x,y` renders the part of the
  picture centred at x,y, as fractions of it, k times larger, which is how to inspect a detail). `scene.html`, `serve.mjs`: the page and static server it drives.
