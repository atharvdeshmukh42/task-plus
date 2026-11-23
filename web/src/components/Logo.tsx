import {
  LOGO_CHECK_PATH,
  LOGO_CHECK_WIDTH,
  LOGO_PLUS_PATH,
  LOGO_PLUS_WIDTH,
  LOGO_TILE_PATH,
  LOGO_VIEWBOX,
} from './logo.generated';

/**
 * The Task Plus mark. The tile uses the SWAAR accent, so a client theme
 * (data-sw-theme) recolours it with the rest of the workspace.
 * Decorative by default; pass `label` when it stands alone.
 */
export function LogoMark({ size = 32, label, className }: { size?: number; label?: string; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={LOGO_VIEWBOX}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={LOGO_TILE_PATH} fill="var(--sw-accent, #2953BC)" />
      <g fill="none" stroke="var(--sw-on-accent, #FFFFFF)" strokeLinecap="round" strokeLinejoin="round">
        <path d={LOGO_CHECK_PATH} strokeWidth={LOGO_CHECK_WIDTH} />
        <path d={LOGO_PLUS_PATH} strokeWidth={LOGO_PLUS_WIDTH} />
      </g>
    </svg>
  );
}

/** Mark plus the "Task Plus" wordmark, for sign-in and other product-level places. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="logo" style={{ fontSize: size * 0.56 }}>
      <LogoMark size={size} />
      <span className="logo__word">Task Plus</span>
    </span>
  );
}
