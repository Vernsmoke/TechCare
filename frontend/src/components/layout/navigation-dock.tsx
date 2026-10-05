'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Vertical adaptation of the reference dock, without resizing link hit areas. */
export function NavigationDock({
  children,
  itemCount,
}: {
  children: ReactNode;
  itemCount: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const items = Array.from(nav.querySelectorAll<HTMLElement>('.nav-icon')).map((icon) => ({
      icon,
      scale: 1,
      velocity: 0,
      target: 1,
    }));
    let frame = 0;
    let previous = 0;
    function animate(time: number) {
      const dt = Math.min((time - (previous || time - 16)) / 1000, 0.032);
      previous = time;
      let moving = false;
      for (const item of items) {
        // Damped spring: neighboring icons follow the pointer smoothly.
        item.velocity += ((item.target - item.scale) * 240 - item.velocity * 22) * dt;
        item.scale += item.velocity * dt;
        if (Math.abs(item.target - item.scale) < 0.001 && Math.abs(item.velocity) < 0.001) {
          item.scale = item.target;
          item.velocity = 0;
        } else moving = true;
        item.icon.style.transform = `scale(${item.scale})`;
      }
      frame = moving ? requestAnimationFrame(animate) : 0;
      if (!moving) previous = 0;
    }
    function update(y: number) {
      for (const item of items) {
        const rect = item.icon.closest('a')!.getBoundingClientRect();
        const proximity = Math.max(0, 1 - Math.abs(y - rect.top - rect.height / 2) / 110);
        item.target = 1 + proximity * 0.22;
      }
      if (!frame) frame = requestAnimationFrame(animate);
    }
    function reset() {
      update(Infinity);
    }
    function move(event: PointerEvent) {
      if (!motion.matches && pointer.matches && event.pointerType === 'mouse')
        update(event.clientY);
    }
    function focus(event: FocusEvent) {
      if (motion.matches) return;
      const link = (event.target as HTMLElement).closest('a');
      if (link) {
        const rect = link.getBoundingClientRect();
        update(rect.top + rect.height / 2);
      }
    }
    function clear() {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      for (const item of items) {
        item.scale = item.target = 1;
        item.velocity = 0;
        item.icon.style.removeProperty('transform');
      }
    }
    nav.addEventListener('pointermove', move);
    nav.addEventListener('pointerleave', reset);
    nav.addEventListener('focusin', focus);
    nav.addEventListener('focusout', reset);
    motion.addEventListener('change', clear);
    pointer.addEventListener('change', clear);
    return () => {
      clear();
      nav.removeEventListener('pointermove', move);
      nav.removeEventListener('pointerleave', reset);
      nav.removeEventListener('focusin', focus);
      nav.removeEventListener('focusout', reset);
      motion.removeEventListener('change', clear);
      pointer.removeEventListener('change', clear);
    };
  }, [itemCount]);

  return (
    <nav ref={ref} id="main-navigation" aria-label="Main navigation" className="animated-dock">
      {children}
    </nav>
  );
}
