# Trophy pictures

The Commissioner's Trophy Room shows the three trophies on a mahogany table that turns. The table is 120 pictures, one for every
3 degrees of a full turn, in `public/trophies/turntable/`. They are 3D renders made here; nothing in this folder is part of the app
build, and the app never runs it.

## When a new champion is crowned

The brass plaques are part of the pictures, so a new champion needs a new set.

1. Edit `champions.json`: add the new champion at the **front** of their pool's list (newest first) as `{ "year": "2026", "name": "GARY" }`
   (co-champions: `"GARY & RICK"`). Pick'em has room for 12 plaques, Bowl Pool for 10, Survivor for 5.
2. Once, install the one dependency: `cd tools/trophy-render && npm install` (run it inside that folder; the `--prefix` form links the whole app into the tool).
3. Render (about 10 to 25 minutes depending on the machine, software rendering, no graphics card needed): `npm run trophies`. To use several processes, run it with `FRAME_PART=0/4 PORT=5900`, `1/4 PORT=5901`, and so on, each with its own port.
4. Commit the changed `public/trophies/turntable/*.webp`, run `npm run test:visual` on a Linux runner (or the visual-baselines workflow) to re-record the Trophy Room screenshots, and open a pull request.

The champions under the table are stadium banners drawn from the records, so they stay correct between a crowning and the
new pictures; only the brass plaques on the trophies themselves are part of the pictures.

## Files

- `turntable.mjs`: renders the 60 frames (`FRAME_PART="k/n"` and `PORT` let several runs share the work).
- `render.mjs`: renders a single named view for design work, for example `node render.mjs pickem_white_coil 880 1400`.
- `table.js`: the mahogany table (three identical round pads 120 degrees apart, so the table is exactly symmetric). `scenes.js`, `trophies.js`, `trophies2.js`, `lib.js`: the scene, the three trophies and the shared materials and textures (three.js).
- `scene.html`, `serve.mjs`: a tiny page and static server the renderer drives in headless Chromium.
