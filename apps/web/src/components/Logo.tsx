interface LogoProps {
  size?: number;
  className?: string;
  ariaLabel?: string;
}

/**
 * Brand mark — a tiny flowchart silhouette. The thing the tool emits IS the logo.
 * Pill (terminal) → diamond (decision) → two squares (default).
 */
export function Logo({ size = 28, className, ariaLabel = 'elsa-to-mermaid' }: LogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={ariaLabel}
      className={className}
    >
      {/* terminal */}
      <rect x="9.5" y="3" width="13" height="5" rx="2.5" />
      {/* trunk */}
      <path d="M16 8 L16 13" />
      {/* decision diamond */}
      <path d="M16 13 L19.2 16 L16 19 L12.8 16 Z" />
      {/* branches */}
      <path d="M13.5 17.4 L8.5 24.4" />
      <path d="M18.5 17.4 L23.5 24.4" />
      {/* leaf nodes */}
      <rect x="5" y="24.5" width="7" height="4.5" rx="0.6" />
      <rect x="20" y="24.5" width="7" height="4.5" rx="0.6" />
    </svg>
  );
}
