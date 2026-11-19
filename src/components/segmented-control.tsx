import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-2 py-1 text-xs",
  md: "px-1.5 py-1.5 text-xs",
  lg: "px-2 py-1.5 text-sm",
};

export interface SegmentOption<T extends string | boolean> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string | boolean> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
  size?: Size;
  className?: string;
}

/** A row of buttons where exactly one is selected (a radio group that looks like tabs). */
export default function SegmentedControl<T extends string | boolean>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  const columns = { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("bg-muted grid gap-1 rounded-lg p-1", className)}
      style={columns}
    >
      {options.map((option) => (
        <SegmentButton
          key={String(option.value)}
          option={option}
          selected={option.value === value}
          size={size}
          onSelect={onChange}
        />
      ))}
    </div>
  );
}

function SegmentButton<T extends string | boolean>({
  option,
  selected,
  size,
  onSelect,
}: {
  option: SegmentOption<T>;
  selected: boolean;
  size: Size;
  onSelect: (value: T) => void;
}) {
  const handleClick = () => onSelect(option.value);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={handleClick}
      className={cn(
        "rounded-md font-medium transition-colors",
        SIZE_CLASSES[size],
        selected
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {option.label}
    </button>
  );
}
