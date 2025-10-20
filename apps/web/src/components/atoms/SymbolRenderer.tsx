/**
 * Symbol Renderer - SVG components for each emotion symbol
 */

import { motion } from "framer-motion";
import type { SymbolSpec, SymbolMotion } from "@/content/regions";

interface SymbolRendererProps {
  spec: SymbolSpec;
  color: string;
  size?: number;
}

const motionVariants: Record<SymbolMotion, any> = {
  pulse: {
    scale: [1, 1.1, 1],
    opacity: [0.8, 1, 0.8],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
  },
  drift: {
    x: [0, 10, 0],
    y: [0, -5, 0],
    transition: { duration: 8, repeat: Infinity, ease: "easeInOut" },
  },
  ripple: {
    scale: [1, 1.2, 1],
    opacity: [1, 0.6, 1],
    transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
  },
  sway: {
    rotate: [-3, 3, -3],
    transition: { duration: 6, repeat: Infinity, ease: "easeInOut" },
  },
  bloom: {
    scale: [0.9, 1, 0.9],
    rotate: [0, 5, 0],
    transition: { duration: 5, repeat: Infinity, ease: "easeInOut" },
  },
};

export default function SymbolRenderer({ spec, color, size = 80 }: SymbolRendererProps) {
  const { kind, motion: motionType } = spec;

  const commonProps = {
    stroke: color,
    strokeWidth: 2,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      animate={motionVariants[motionType]}
      style={{ overflow: "visible" }}
    >
      {kind === "orb" && (
        <circle cx="50" cy="50" r="30" {...commonProps} />
      )}

      {kind === "spire" && (
        <path
          d="M 50 20 L 65 80 L 50 70 L 35 80 Z"
          {...commonProps}
        />
      )}

      {kind === "vine" && (
        <path
          d="M 30 80 Q 30 50, 50 40 T 70 80"
          {...commonProps}
        />
      )}

      {kind === "dune" && (
        <path
          d="M 20 70 Q 35 50, 50 60 T 80 70"
          {...commonProps}
        />
      )}

      {kind === "wave" && (
        <>
          <path d="M 20 50 Q 35 40, 50 50 T 80 50" {...commonProps} opacity={0.6} />
          <path d="M 20 60 Q 35 50, 50 60 T 80 60" {...commonProps} />
        </>
      )}

      {kind === "ember" && (
        <>
          <circle cx="50" cy="45" r="15" {...commonProps} />
          <path d="M 50 60 L 45 75" {...commonProps} />
          <path d="M 50 60 L 55 75" {...commonProps} />
        </>
      )}

      {kind === "veil" && (
        <>
          <line x1="30" y1="20" x2="30" y2="80" {...commonProps} opacity={0.4} />
          <line x1="45" y1="25" x2="45" y2="75" {...commonProps} opacity={0.6} />
          <line x1="55" y1="25" x2="55" y2="75" {...commonProps} opacity={0.6} />
          <line x1="70" y1="20" x2="70" y2="80" {...commonProps} opacity={0.4} />
        </>
      )}

      {kind === "ray" && (
        <>
          <line x1="50" y1="50" x2="30" y2="30" {...commonProps} />
          <line x1="50" y1="50" x2="70" y2="30" {...commonProps} />
          <line x1="50" y1="50" x2="80" y2="50" {...commonProps} />
          <line x1="50" y1="50" x2="70" y2="70" {...commonProps} />
          <line x1="50" y1="50" x2="30" y2="70" {...commonProps} />
          <line x1="50" y1="50" x2="20" y2="50" {...commonProps} />
        </>
      )}
    </motion.svg>
  );
}
