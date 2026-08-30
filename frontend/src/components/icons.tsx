import React from "react"

/**
 * Lightweight SVG icon set (stroke-based, Lucide-compatible API).
 * No external icon dependency — keeps the bundle small and self-contained.
 */
interface IconProps {
  className?: string
  "aria-hidden"?: boolean | "true" | "false"
}

const base = (props: IconProps) => ({
  className: props.className || "w-4 h-4",
  "aria-hidden": (props["aria-hidden"] as any) ?? true,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
})

export const ChevronRight = (props: IconProps) => (
  <svg {...base(props)}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

export const ChevronLeft = (props: IconProps) => (
  <svg {...base(props)}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

export const ChevronDown = (props: IconProps) => (
  <svg {...base(props)}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

export const Menu = (props: IconProps) => (
  <svg {...base(props)}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)

export const X = (props: IconProps) => (
  <svg {...base(props)}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export const Search = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

export const Bell = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

export const ArrowRight = (props: IconProps) => (
  <svg {...base(props)}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
)

export const Check = (props: IconProps) => (
  <svg {...base(props)}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export const Eye = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const EyeOff = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

export const Plus = (props: IconProps) => (
  <svg {...base(props)}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

export const FolderPlus = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </svg>
)

export const Sparkles = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" />
  </svg>
)

export const Cpu = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
    <rect x="9" y="9" width="6" height="6" />
    <line x1="9" y1="1" x2="9" y2="4" />
    <line x1="15" y1="1" x2="15" y2="4" />
    <line x1="9" y1="20" x2="9" y2="23" />
    <line x1="15" y1="20" x2="15" y2="23" />
    <line x1="20" y1="9" x2="23" y2="9" />
    <line x1="20" y1="15" x2="23" y2="15" />
    <line x1="1" y1="9" x2="4" y2="9" />
    <line x1="1" y1="15" x2="4" y2="15" />
  </svg>
)

export const FlaskConical = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
    <path d="M8.5 2h7" />
    <path d="M7 16h10" />
  </svg>
)

export const Rocket = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
)

export const Bot = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3" y="8" width="18" height="12" rx="4" ry="4" />
    <line x1="12" y1="8" x2="12" y2="4" />
    <rect x="11" y="2" width="2" height="2" />
    <circle cx="9" cy="13" r="1" />
    <circle cx="15" cy="13" r="1" />
    <line x1="9" y1="16" x2="15" y2="16" />
  </svg>
)

export const Globe = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
)

export const LayoutGrid = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
)

export const Building = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <line x1="9" y1="22" x2="9" y2="18" />
    <line x1="15" y1="22" x2="15" y2="18" />
    <line x1="9" y1="9" x2="9" y2="9.01" />
    <line x1="15" y1="9" x2="15" y2="9.01" />
    <line x1="9" y1="13" x2="9" y2="13.01" />
    <line x1="15" y1="13" x2="15" y2="13.01" />
  </svg>
)
