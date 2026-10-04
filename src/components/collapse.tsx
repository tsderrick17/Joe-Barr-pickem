"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const SLIDE_MS = 340;
const EASING = "cubic-bezier(.4, 0, .2, 1)";

/**
 * Slides its content open and shut. Content is always laid out at its natural
 * size and fully visible; the slide is only a height animation layered on top,
 * so if an animation never runs the content is still in its correct state.
 * Closed content is not kept on the page. Content that starts open appears at
 * once, with no slide.
 */
export default function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const element = useRef<HTMLDivElement>(null);
  const previous = useRef(open);
  const running = useRef<Animation | null>(null);

  // Mount the content as soon as it should open (adjusting state while rendering, as React allows).
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (previous.current === open) return;
    previous.current = open;
    const node = element.current;
    const current = node?.getBoundingClientRect().height ?? 0;
    running.current?.cancel();
    running.current = null;
    const slide = !window.matchMedia("(prefers-reduced-motion: reduce)").matches && typeof node?.animate === "function";
    if (!node || !slide) {
      if (!open) setMounted(false);
      return;
    }
    const target = open ? node.scrollHeight : 0;
    node.style.overflow = "hidden";
    const animation = node.animate(
      [{ height: `${open ? current : node.scrollHeight}px`, opacity: open ? current / Math.max(node.scrollHeight, 1) : 1 }, { height: `${target}px`, opacity: open ? 1 : 0 }],
      { duration: SLIDE_MS, easing: EASING },
    );
    running.current = animation;
    const settle = () => {
      if (running.current !== animation) return;
      running.current = null;
      node.style.overflow = "";
      if (!open) setMounted(false);
    };
    animation.onfinish = settle;
    animation.oncancel = settle;
  }, [open]);

  if (!mounted) return null;
  return <div className="slide-section" ref={element}>{children}</div>;
}
