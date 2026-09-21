import React from "react";
import Svg, { Path, Circle, Rect } from "react-native-svg";

interface Props {
  d: string | string[];
  size?: number;
  color?: string;
  strokeWidth?: number;
  filled?: boolean;
}

/** A single- or multi-path line icon on a 24×24 viewBox — matches the prototype's inline SVGs (README.md "Assets"). */
export function Icon({ d, size = 20, color = "currentColor", strokeWidth = 2, filled = false }: Props) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths.map((p, i) => (
        <Path key={i} d={p} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill={filled ? color : "none"} />
      ))}
    </Svg>
  );
}

/** The signal-bars glyph in the status bar. */
export function SignalIcon({ color }: { color: string }) {
  return (
    <Svg width={15} height={11} viewBox="0 0 18 13" fill={color}>
      <Rect x={0} y={8} width={3} height={5} rx={1} />
      <Rect x={5} y={5} width={3} height={8} rx={1} />
      <Rect x={10} y={2.5} width={3} height={10.5} rx={1} opacity={0.35} />
      <Rect x={15} y={0} width={3} height={13} rx={1} opacity={0.35} />
    </Svg>
  );
}

export function Dot({ color, size = 9 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      <Circle cx={5} cy={5} r={5} fill={color} />
    </Svg>
  );
}
