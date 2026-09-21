import React, { useMemo } from "react";
import Svg, { Rect, G } from "react-native-svg";

/** A procedurally-drawn placeholder QR (README's Assets note: "replace with a real QR encoder" — decorative only, deterministic per `seed`). */
export function QrGraphic({ seed, size = 190 }: { seed: number; size?: number }) {
  const cells = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < 22; i++) {
      for (let j = 0; j < 22; j++) {
        const finder = (i < 6 && j < 6) || (i < 6 && j > 15) || (i > 15 && j < 6);
        if (finder) continue;
        const value = (i * 7 + j * 13 + i * j * 3 + seed) % 11;
        if (value > 5) out.push({ x: j * 8 + 2, y: i * 8 + 2 });
      }
    }
    return out;
  }, [seed]);

  const eye = (x: number, y: number) => (
    <G key={`e${x}${y}`}>
      <Rect x={x} y={y} width={44} height={44} rx={8} fill="none" stroke="#0F1A17" strokeWidth={7} />
      <Rect x={x + 14} y={y + 14} width={16} height={16} rx={3} fill="#0F1A17" />
    </G>
  );

  return (
    <Svg width={size} height={size} viewBox="0 0 180 180">
      <Rect width={180} height={180} rx={12} fill="#fff" />
      {cells.map((cell) => (
        <Rect key={`${cell.x}-${cell.y}`} x={cell.x} y={cell.y} width={7} height={7} rx={1.4} fill="#0F1A17" />
      ))}
      {eye(4, 4)}
      {eye(132, 4)}
      {eye(4, 132)}
    </Svg>
  );
}
