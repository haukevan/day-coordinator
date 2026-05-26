import { cn } from "@/lib/utils";

interface LogoProps {
  readonly size?: "sm" | "md" | "lg";
  readonly iconOnly?: boolean;
  readonly className?: string;
}

const iconSizes = { sm: 16, md: 20, lg: 26 } as const;
const textSizes = {
  sm: "text-sm font-semibold",
  md: "text-base font-semibold",
  lg: "text-xl font-bold",
} as const;

export function Logo({ size = "md", iconOnly = false, className }: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-foreground",
        className,
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        width={iconSizes[size]}
        height={iconSizes[size]}
        aria-hidden="true"
        className="flex-shrink-0"
      >
        <rect
          x="4.5"
          y="5"
          width="15"
          height="3.5"
          rx="1.2"
          stroke="currentColor"
          opacity="0.35"
          strokeWidth="1.5"
        />
        <rect
          x="4.5"
          y="10.5"
          width="15"
          height="3.5"
          rx="1.2"
          fill="currentColor"
        />
        <rect
          x="4.5"
          y="16"
          width="15"
          height="3.5"
          rx="1.2"
          stroke="currentColor"
          opacity="0.35"
          strokeWidth="1.5"
        />
      </svg>
      {!iconOnly && (
        <span className={cn("tracking-tight", textSizes[size])}>
          Day Coordinator
        </span>
      )}
    </span>
  );
}
