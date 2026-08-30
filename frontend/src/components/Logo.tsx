import React from "react"

interface LogoProps {
  /** CSS class applied to the <img> element. */
  className?: string
  /** Explicit width in pixels (height scales proportionally). */
  width?: number
  /** Override alt text. Defaults to "SkyNova Project Labs". */
  alt?: string
}

/**
 * Reusable brand logo component.
 * Renders the official /logo.png with correct aspect ratio and no distortion.
 */
const Logo: React.FC<LogoProps> = ({ className = "site-logo", width = 90, alt = "SkyNova Project Labs" }) => (
  <img
    src="/logo.png"
    alt={alt}
    width={width}
    className={className}
    draggable={false}
  />
)

export default Logo
