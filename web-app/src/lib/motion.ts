import type { CSSProperties } from "react";

/**
 * Stagger timings for the "cardIn" tier of the motion system (see
 * project/design_handoff_sahaj/README.md, "Motion" — the stagger-timing
 * table). Each repeating unit — a table row, a kanban card, a calendar
 * cell, a stat tile — gets a delay computed from its own index and passed
 * as an inline `animationDelay`, never selected on an inline style string.
 *
 * `animation-fill-mode: both` is baked into every animation shorthand
 * below so an item stays invisible through its delay rather than flashing
 * in at 0, matching the README's reduced-motion note.
 */

const EASE_OUT = "cubic-bezier(.22,1,.36,1)";

/** List rows inside a screen block (table rows, notification lists). */
export function listRowDelay(i: number): number {
  return Math.min(0.78, 0.14 + i * 0.065);
}
export function listRowStyle(i: number): CSSProperties {
  return { animation: `cardIn .46s ${EASE_OUT} both`, animationDelay: `${listRowDelay(i)}s` };
}

/** Tagged/repeating cards (kanban cards, calendar cells, stat tiles). */
export function taggedCardDelay(i: number): number {
  return Math.min(0.78, 0.1 + i * 0.085);
}
export function taggedCardStyle(i: number): CSSProperties {
  return { animation: `cardIn .56s ${EASE_OUT} both`, animationDelay: `${taggedCardDelay(i)}s` };
}

/** Settings/preference rows — uncapped per the README's table. */
export function prefRowDelay(i: number): number {
  return 0.38 + i * 0.07;
}
export function prefRowStyle(i: number): CSSProperties {
  return { animation: `cardIn .56s ${EASE_OUT} both`, animationDelay: `${prefRowDelay(i)}s` };
}

/** Screen content blocks — capped at .9s. */
export function blockDelay(i: number): number {
  return Math.min(0.9, i * 0.075);
}
export function blockStyle(i: number): CSSProperties {
  return { animation: `cardIn .5s ${EASE_OUT} both`, animationDelay: `${blockDelay(i)}s` };
}
