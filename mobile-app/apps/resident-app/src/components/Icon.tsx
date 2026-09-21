import React from "react";
import Svg, { Path } from "react-native-svg";

/** Every icon is an inline SVG on a 24×24 viewBox (README's "Assets") — this renders one `d` path. */
export function Icon({ d, size = 21, color, strokeWidth = 1.9 }: { d: string; size?: number; color: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
