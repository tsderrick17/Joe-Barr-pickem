"use client";

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

// Window blinds: the bottom edge travels at an even, gentle pace and eases in
// and out at the ends. Content never fades or squashes; it is uncovered.
export const BLIND_MS = 420;
export const BLIND_EASING = "cubic-bezier(.65, 0, .35, 1)";

function canSlide(node: HTMLElement | null | undefined): node is HTMLElement {
  return !!node && typeof node.animate === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Slides its content open and shut like a window blind. Content is always laid
 * out at its natural size and fully visible; the slide is only a height
 * animation layered on top, so if an animation never runs the content is still
 * in its correct state. Closed content is not kept on the page. Content that
 * starts open appears at once, with no slide.
 */
export default function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const element = useRef<HTMLDivElement>(null);
  const previous = useRef(open);
  const running = useRef<Animation | null>(null);

  // Mount the content as soon as it should open (adjusting state while rendering, as React allows).
  if (open && !mounted) setMounted(true);

  // A layout effect runs before the browser paints, so newly opened content is
  // never shown at full height for a frame before the slide starts.
  useLayoutEffect(() => {
    if (previous.current === open) return;
    previous.current = open;
    const node = element.current;
    if (!canSlide(node)) {
      if (!open) window.setTimeout(() => setMounted(false), 0);
      return;
    }
    // Reversing mid-slide starts from wherever the blind is now.
    const midway = running.current;
    const current = node.getBoundingClientRect().height;
    running.current = null;
    midway?.cancel();
    const full = node.scrollHeight;
    const from = open ? (midway ? current : 0) : current;
    const to = open ? full : 0;
    node.style.overflow = "hidden";
    const animation = node.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: BLIND_MS * (Math.abs(to - from) / Math.max(full, 1)) ** 0.5, easing: BLIND_EASING, fill: open ? "none" : "forwards" });
    running.current = animation;
    animation.onfinish = () => {
      if (running.current !== animation) return;
      running.current = null;
      if (open) node.style.overflow = "";
      else window.setTimeout(() => setMounted(false), 0);
    };
  }, [open]);

  if (!mounted) return null;
  return <div className="slide-section" ref={element}>{children}</div>;
}

/**
 * Rows marked `data-blind-row` inside `container` roll up and down like a blind
 * when `hidden` changes. Returns whether those rows should be left out of the
 * render: hidden rows stay on the page until they have rolled shut, and shown
 * rows are put back at once and roll open.
 */
export function useBlindRows(hidden: boolean, container: RefObject<HTMLElement | null>) {
  const [rowsHidden, setRowsHidden] = useState(hidden);
  const previous = useRef(hidden);
  const running = useRef<Animation[]>([]);
  // Animations that hold their end state until the rolled rows have left the page.
  const holding = useRef<Animation[]>([]);

  if (!hidden && rowsHidden) setRowsHidden(false);

  // Once the rows are gone the page itself is in the end state, so let go of the held animations.
  useLayoutEffect(() => {
    if (!rowsHidden) return;
    for (const animation of holding.current) animation.cancel();
    holding.current = [];
  }, [rowsHidden]);

  useLayoutEffect(() => {
    if (previous.current === hidden) return;
    previous.current = hidden;
    for (const animation of [...running.current, ...holding.current]) animation.cancel();
    running.current = [];
    holding.current = [];
    const rows = [...(container.current?.querySelectorAll<HTMLElement>("[data-blind-row]") ?? [])];
    if (!rows.length || !canSlide(rows[0])) {
      if (hidden) window.setTimeout(() => setRowsHidden(true), 0);
      return;
    }
    const animations = rows.map((row) => {
      const height = row.getBoundingClientRect().height;
      row.style.overflow = "hidden";
      // A row cannot be shorter than its border, and browsers keep a border of under a pixel at a full
      // pixel, so a negative margin takes the border back smoothly instead of it vanishing at the end.
      const border = parseFloat(getComputedStyle(row).borderBottomWidth) || 0;
      const frames = [{ height: `${height}px`, marginBottom: "0px" }, { height: "0px", marginBottom: `${-border}px` }];
      return row.animate(hidden ? frames : [...frames].reverse(), { duration: BLIND_MS, easing: BLIND_EASING, fill: hidden ? "forwards" : "none" });
    });
    // When the rolled rows are the last ones, the row above them is about to become the last row and lose
    // its bottom border (`last:border-b-0`). Fade that border with the roll so nothing below jumps at the end.
    const container_ = container.current;
    let before = container_?.lastElementChild ?? null;
    while (before instanceof HTMLElement && before.hasAttribute("data-blind-row")) before = before.previousElementSibling;
    if (before instanceof HTMLElement && before !== container_?.lastElementChild && before.matches(".border-b")) {
      const border = parseFloat(getComputedStyle(before).borderBottomWidth) || 0;
      const frames = [{ marginBottom: "0px" }, { marginBottom: `${-border}px` }];
      animations.push(before.animate(hidden ? frames : [...frames].reverse(), { duration: BLIND_MS, easing: BLIND_EASING, fill: hidden ? "forwards" : "none" }));
    }
    running.current = animations;
    animations[0].onfinish = () => {
      if (running.current !== animations) return;
      running.current = [];
      if (hidden) {
        holding.current = animations;
        window.setTimeout(() => setRowsHidden(true), 0);
      } else for (const row of rows) row.style.overflow = "";
    };
  }, [hidden, container]);

  return rowsHidden;
}
