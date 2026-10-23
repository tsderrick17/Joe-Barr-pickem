"use client";

import { useEffect, useRef } from "react";
import { clothSheen, clothShift } from "@/lib/banner-wave.js";

/**
 * One champion's banner, hanging from a brass rod on two cords: cut-felt lettering on a stitched, swallowtailed field. The cloth is drawn once onto a hidden
 * canvas at the screen's full device resolution and then laid onto the visible one a couple of device pixels of height at a time, each row shifted sideways
 * by a swing from the rod and a wave running down the cloth (see `clothShift`) and lightened or darkened by how the cloth leans (`clothSheen`). Every row
 * moves a little differently from its neighbour, so the edges, stitching and lettering bend in one smooth curve instead of stepping, and the folds catch
 * the light as the wave passes. Nothing is rotated or scaled, so it stays sharp. The rod, cords and balls stay put. The cloth holds still while the table
 * is being turned (`still`), keeping the page's busiest moment free, and does not move at all for reduced motion, in automated browsers, or while the banner is off screen.
 * Colours come from `--banner`, `--banner-dark` and `--banner-light` on the rafters (red Pick'em, blue Bowl, green Survivor).
 */
const WIDTH = 170, ROD_Y = 24, TOP = 30, YEAR_ROW = 26, MARGIN = 8;   // MARGIN: room on each side for the cloth to swing
const SLICE = 2;               // device pixels of height moved together
const FRAME_MS = 33;           // about 30 frames a second

const pleat = (x: number, folds: number, phase: number) => 0.5 - 0.5 * Math.cos(Math.PI * 2 * (folds * x + phase + 0.05 * Math.sin(Math.PI * 2 * 1.3 * x)));   // 0 on a ridge, 1 in a valley

type Colour = [number, number, number];
let probe: CanvasRenderingContext2D | null = null;
/** Any CSS colour (the banner colours are oklch) as red, green, blue: the browser itself does the conversion. */
function rgbOf(css: string, fallback: Colour): Colour {
  probe ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
  if (!probe || !css) return fallback;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  return a === 0 ? fallback : [r, g, b];
}
const rgba = ([r, g, b]: Colour, alpha = 1) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

export default function TrophyBanner({ tag, name, years, index, still = false }: { tag: string; name: string; years: number[]; index: number; still?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const holding = useRef(still);
  useEffect(() => { holding.current = still; }, [still]);

  // a long tag (Bowl Pool, Survivor) wraps onto two lines at a larger size, pushing the rest down a little
  const tagLines = tag.includes(" ") ? [tag.slice(0, tag.lastIndexOf(" ")), tag.slice(tag.lastIndexOf(" ") + 1)] : [tag];   // every title wraps onto two lines
  const extra = (tagLines.length - 1) * 15;
  const height = 224 + extra + YEAR_ROW * Math.max(0, years.length - 2);
  const bottom = TOP + height;
  const total = bottom + 14;   // the picture's height in banner units
  const yearsKey = years.join(",");

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    const display = target.getContext("2d");
    if (!display) return;
    const lines = tag.includes(" ") ? [tag.slice(0, tag.lastIndexOf(" ")), tag.slice(tag.lastIndexOf(" ") + 1)] : [tag];
    const lettered = yearsKey.split(",");
    let cancelled = false, frame = 0, visible = true, clock = 0, last = 0;
    // reduced motion keeps the cloth still; so do automated browsers (the screenshot tests), so a picture never catches the cloth mid-swing
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches || navigator.webdriver;
    const phase = 0.12 * index;
    const nameSize = Math.min(35, 146 / (Math.max(3, name.length) * 0.5));
    const body = `M6 ${TOP}H${WIDTH - 6}V${bottom}L${WIDTH / 2} ${bottom - 36}L6 ${bottom}Z`;
    const stitch = `M14 ${TOP + 17}H${WIDTH - 14}V${bottom - 11}L${WIDTH / 2} ${bottom - 44}L14 ${bottom - 11}Z`;
    const inner = `M17.6 ${TOP + 20.6}H${WIDTH - 17.6}V${bottom - 15}L${WIDTH / 2} ${bottom - 49}L17.6 ${bottom - 15}Z`;
    const tagSize = lines.length > 1 ? 13.4 : Math.min(12, (12 * 16) / Math.max(1, tag.length));   // the title is the banner's headline: large, in bold gold capitals
    const nameY = TOP + 90 + extra, yearY = TOP + 124 + extra;
    let scale = 1, cloth: HTMLCanvasElement | null = null, fixtures: HTMLCanvasElement | null = null, work: HTMLCanvasElement | null = null;

    const layer = () => {
      const made = document.createElement("canvas");
      made.width = target.width; made.height = target.height;
      const context = made.getContext("2d")!;
      context.setTransform(scale, 0, 0, scale, MARGIN * scale, 0);   // from here on, banner units
      return { made, context };
    };

    /** The static art: the cloth with its folds, stitching and lettering; and apart from it the rod, cords and balls. */
    const paint = () => {
      const style = getComputedStyle(target);
      const base = rgbOf(style.getPropertyValue("--banner").trim(), [150, 30, 40]);
      const dark = rgbOf(style.getPropertyValue("--banner-dark").trim(), [70, 10, 20]);
      const light = rgbOf(style.getPropertyValue("--banner-light").trim(), [190, 60, 70]);
      const graduate = style.getPropertyValue("--font-graduate").trim() || "Georgia, serif";
      const cormorant = style.getPropertyValue("--font-cormorant").trim() || "Georgia, serif";

      const art = layer();
      cloth = art.made;
      const c = art.context;
      const vertical = (y0: number, y1: number, stops: Array<[number, string]>) => {
        const gradient = c.createLinearGradient(0, y0, 0, y1);
        for (const [at, color] of stops) gradient.addColorStop(at, color);
        return gradient;
      };
      const across = (kind: "dark" | "light") => {
        const gradient = c.createLinearGradient(0, 0, WIDTH, 0);
        for (let i = 0; i <= 40; i += 1) {
          const x = i / 40, valley = pleat(x, 2.4, phase);
          gradient.addColorStop(x, kind === "dark" ? `rgba(0, 0, 0, ${(0.3 * Math.pow(valley, 1.15)).toFixed(3)})` : `rgba(255, 255, 255, ${(0.18 * Math.pow(1 - valley, 2.5)).toFixed(3)})`);
        }
        return gradient;
      };
      c.save();
      c.clip(new Path2D(body));
      c.fillStyle = vertical(TOP, TOP + height, [[0, rgba(light, 0.55)], [0.4, rgba(base)], [1, rgba(dark)]]);
      c.fillRect(0, TOP, WIDTH, height);
      c.fillStyle = across("dark"); c.fillRect(0, TOP, WIDTH, height);
      c.fillStyle = across("light"); c.fillRect(0, TOP, WIDTH, height);
      c.fillStyle = vertical(TOP, TOP + height, [[0, "rgba(0, 0, 0, 0.4)"], [0.12, "rgba(0, 0, 0, 0.06)"], [1, "rgba(0, 0, 0, 0.22)"]]);
      c.fillRect(0, TOP, WIDTH, height);
      c.restore();
      c.lineJoin = "round";
      c.strokeStyle = "rgba(0, 0, 0, 0.35)"; c.lineWidth = 1; c.stroke(new Path2D(body));
      c.strokeStyle = "#e6c46e"; c.lineWidth = 1.5; c.stroke(new Path2D(stitch));
      c.strokeStyle = "rgba(246, 230, 180, 0.75)"; c.lineWidth = 0.7; c.stroke(new Path2D(inner));
      for (const [x, y] of [[14, TOP + 17], [WIDTH - 14, TOP + 17], [14, bottom - 11], [WIDTH - 14, bottom - 11], [WIDTH / 2, bottom - 44]]) {
        c.beginPath(); c.moveTo(x, y - 3.2); c.lineTo(x + 3.2, y); c.lineTo(x, y + 3.2); c.lineTo(x - 3.2, y); c.closePath();
        c.fillStyle = "#e6c46e"; c.fill(); c.strokeStyle = "rgba(42, 20, 5, 0.5)"; c.lineWidth = 0.5; c.stroke();
      }
      c.fillStyle = rgba(dark); c.fillRect(6, TOP - 2, WIDTH - 12, 18);   // the sleeve the rod runs through
      c.fillStyle = across("dark"); c.fillRect(6, TOP - 2, WIDTH - 12, 18);
      c.strokeStyle = "rgba(0, 0, 0, 0.35)"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(6, TOP + 16); c.lineTo(WIDTH - 6, TOP + 16); c.stroke();
      c.globalAlpha = 0.5; c.fillStyle = across("dark"); c.fillRect(6, TOP + 16, WIDTH - 12, height - 52); c.globalAlpha = 1;

      // the lettering is part of the cloth, so it bends with it
      const spaced = (text: string, y: number, spacing: number, fill: string, edge: { color: string; width: number }) => {
        const letters = [...text], widths = letters.map((letter) => c.measureText(letter).width);
        const span = widths.reduce((sum, w) => sum + w, 0) + spacing * (letters.length - 1);
        c.textAlign = "left";
        for (const pass of ["edge", "fill"]) {   // every outline first, so a neighbour's outline never cuts into a letter
          let x = WIDTH / 2 - span / 2;
          letters.forEach((letter, i) => {
            if (pass === "edge") { c.strokeStyle = edge.color; c.lineWidth = edge.width; c.strokeText(letter, x, y); } else { c.fillStyle = fill; c.fillText(letter, x, y); }
            x += widths[i] + spacing;
          });
        }
      };
      c.textBaseline = "alphabetic";
      c.font = `${tagSize}px ${graduate}`;
      lines.forEach((line, i) => spaced(line.toUpperCase(), TOP + 56 + i * 16, 1.6, "#fae9a8", { color: "#2a1405", width: 1.5 }));
      c.font = `700 ${nameSize}px ${cormorant}`;
      c.textAlign = "center"; c.lineWidth = 2.2; c.strokeStyle = "#2a1405"; c.strokeText(name, WIDTH / 2, nameY);
      c.fillStyle = "#fbe7a1"; c.fillText(name, WIDTH / 2, nameY);
      c.font = "12px Georgia, serif"; c.fillStyle = "#f8e29a"; c.fillText("★", WIDTH / 2, nameY + 21);
      c.font = `23px ${graduate}`;
      lettered.forEach((year, i) => spaced(year, yearY + 22 + i * YEAR_ROW, 1.5, "#fff6d8", { color: "#1d0a05", width: 2.2 }));

      const hardware = layer();
      fixtures = hardware.made;
      const f = hardware.context;
      f.strokeStyle = "#cdb98a"; f.lineWidth = 1.6; f.beginPath(); f.moveTo(32, ROD_Y + 1); f.lineTo(WIDTH / 2, 0); f.lineTo(WIDTH - 32, ROD_Y + 1); f.stroke();
      const brass = f.createLinearGradient(0, ROD_Y, 0, ROD_Y + 8);
      for (const [at, color] of [[0, "#fff0b0"], [0.35, "#e2b64a"], [0.7, "#9a6f1c"], [1, "#d9aa3e"]] as const) brass.addColorStop(at, color);
      f.fillStyle = brass; f.beginPath(); f.roundRect(12, ROD_Y, WIDTH - 24, 8, 4); f.fill();
      for (const x of [10, WIDTH - 10]) {
        const focusX = x - 7 + 0.35 * 14, focusY = ROD_Y + 4 - 7 + 0.3 * 14;
        const ball = f.createRadialGradient(focusX, focusY, 0, focusX, focusY, 0.8 * 14);
        for (const [at, color] of [[0, "#fff6c8"], [0.45, "#e0b142"], [1, "#7d5612"]] as const) ball.addColorStop(at, color);
        f.fillStyle = ball; f.beginPath(); f.arc(x, ROD_Y + 4, 7, 0, Math.PI * 2); f.fill();
      }
      work = layer().made;
    };

    /** The banner at time `t`: every row of the cloth shifted and lit, then the rod on top. */
    const render = (t: number) => {
      if (!cloth || !fixtures || !work) return;
      const w = work.getContext("2d")!;
      w.setTransform(1, 0, 0, 1, 0, 0);
      w.clearRect(0, 0, work.width, work.height);
      const first = Math.floor((TOP - 3) * scale), end = Math.min(work.height, Math.ceil((bottom + 2) * scale));
      if (calm) {
        w.drawImage(cloth, 0, first, work.width, end - first, 0, first, work.width, end - first);
      } else {
        const span = (bottom - TOP) * scale;
        for (let row = first; row < end; row += SLICE) {
          const u = Math.max(0, Math.min(1, (row - TOP * scale) / span));
          w.drawImage(cloth, 0, row, work.width, SLICE, clothShift(u, t) * scale, row, work.width, SLICE);
        }
        // the light along the folds, only where there is cloth
        w.globalCompositeOperation = "source-atop";
        const band = 8;
        for (let row = first; row < end; row += band) {
          const sheen = clothSheen(Math.max(0, Math.min(1, (row + band / 2 - TOP * scale) / span)), t, bottom - TOP);
          w.fillStyle = sheen > 0 ? `rgba(255, 255, 255, ${(sheen * 0.16).toFixed(3)})` : `rgba(0, 0, 0, ${(-sheen * 0.2).toFixed(3)})`;
          w.fillRect(0, row, work.width, band);
        }
        w.globalCompositeOperation = "source-over";
      }
      display.setTransform(1, 0, 0, 1, 0, 0);
      display.clearRect(0, 0, target.width, target.height);
      display.fillStyle = "rgba(0, 0, 0, 0.35)";
      display.beginPath(); display.ellipse((MARGIN + WIDTH / 2) * scale, (TOP + 4) * scale, (WIDTH / 2 - 8) * scale, 5 * scale, 0, 0, Math.PI * 2); display.fill();
      display.drawImage(work, 0, 0);
      display.drawImage(fixtures, 0, 0);
    };

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const wide = Math.max(1, Math.round(target.clientWidth * dpr));
      if (wide === target.width && cloth) return;
      scale = wide / (WIDTH + 2 * MARGIN);
      target.width = wide; target.height = Math.round(total * scale);
      paint();
      render(clock + index * 0.7);
    };
    size();

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const elapsed = last ? Math.min(100, now - last) : 0;
      if (elapsed && elapsed < FRAME_MS - 2) return;
      last = now;
      if (!visible || holding.current) return;
      clock += elapsed / 1000;
      render(clock + index * 0.7);
    };
    if (!calm) frame = requestAnimationFrame(tick);

    const watcher = new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? true; });
    watcher.observe(target);
    const resizer = new ResizeObserver(() => size());
    resizer.observe(target);
    // the lettering faces load on first use: redraw once they have arrived so the banner never keeps its stand-in letters
    void document.fonts?.ready.then(() => { if (!cancelled && cloth) { paint(); render(clock + index * 0.7); } });

    return () => { cancelled = true; cancelAnimationFrame(frame); watcher.disconnect(); resizer.disconnect(); };
  }, [bottom, extra, height, index, name, tag, total, yearsKey]);

  return (
    <div aria-hidden="true" className="trophy-banner-art" style={{ aspectRatio: `${WIDTH} / ${total}` }}>
      <canvas ref={canvas} />
    </div>
  );
}
