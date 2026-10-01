export function Logo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#3dffb0" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M8.5 7.5 12 12l-3.5 4.5M15.5 7.5 12 12l3.5 4.5" />
    </svg>
  );
}
