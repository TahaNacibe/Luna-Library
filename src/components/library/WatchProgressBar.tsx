/**
 * Reusable Watch Progress Bar Component.
 * 
 * Provides a clean, modern, animated indicator for playback completion.
 * Matches the deep gray / milk white design system and adapts dynamically
 * when a movie or episode is completely watched or actively in-progress.
 */

interface WatchProgressBarProps {
  percent: number;
  isWatched?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  rounded?: "none" | "sm" | "md" | "full";
  className?: string;
  showGlow?: boolean;
}

export default function WatchProgressBar({
  percent,
  isWatched = false,
  size = "sm",
  rounded = "full",
  className = "",
  showGlow = false,
}: WatchProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, isWatched ? 100 : percent));

  if (clamped <= 0 && !isWatched) {
    return null;
  }

  // Dimension heights
  const heightClasses = {
    xs: "h-1",
    sm: "h-1.5",
    md: "h-2",
    lg: "h-2.5",
  }[size];

  // Border radius styles
  const roundedClasses = {
    none: "rounded-none",
    sm: "rounded-xs",
    md: "rounded-sm",
    full: "rounded-full",
  }[rounded];

  // Colors: Emerald green for 100% completed/watched; Primary purple/blue for in-progress
  const barColor = isWatched || clamped >= 90
    ? "bg-emerald-500 text-emerald-500"
    : "bg-primary text-primary";

  return (
    <div
      className={`w-full bg-black/30 dark:bg-white/10 overflow-hidden ${heightClasses} ${roundedClasses} ${className}`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full ${roundedClasses} ${barColor} transition-all duration-500 ease-out ${
          showGlow ? "shadow-[0_0_8px_currentColor]" : ""
        }`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
