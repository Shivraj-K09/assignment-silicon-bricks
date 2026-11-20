import { Popover } from "@base-ui/react/popover";
import { CircleHelp, Hand, Move3d, MousePointer2, Spline, ZoomIn } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Step = { Icon: LucideIcon; action: string; how: React.ReactNode };

/** Mouse and keyboard ways to move the map. */
const MOUSE: Step[] = [
  { Icon: Hand, action: "Move", how: "Drag the map" },
  {
    Icon: Move3d,
    action: "Turn and tilt",
    how: (
      <>
        <Key>Ctrl</Key> + drag, or right-drag
      </>
    ),
  },
  { Icon: ZoomIn, action: "Zoom", how: "Scroll, or double-click" },
  { Icon: Spline, action: "Reshape the plot", how: "Drag a corner circle; drag inside to move it" },
  {
    Icon: MousePointer2,
    action: "Road side",
    how: "Click an edge of the plot",
  },
];

/** The same on a touch screen. */
const TOUCH: { action: string; how: string }[] = [
  { action: "Move", how: "Drag with one finger" },
  { action: "Zoom", how: "Pinch" },
  { action: "Turn and tilt", how: "Twist, or drag up and down, with two fingers" },
];

/** A "?" button for the map tools, opening a short card on how to move the map. */
export default function MapHelp({
  triggerClassName,
  open,
  onOpenChange,
}: {
  triggerClassName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const handleOpenChange = (next: boolean) => onOpenChange(next);
  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger aria-label="How to move the map" className={triggerClassName}>
        <CircleHelp aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="left" align="center" sideOffset={14} className="z-50">
          <Popover.Popup className="w-72 origin-[var(--transform-origin)] rounded-[20px] bg-neutral-100/90 p-1.5 shadow-xl ring-1 shadow-black/10 ring-black/5 backdrop-blur-xl transition-[transform,opacity] duration-200 ease-out outline-none data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <div className="rounded-2xl border border-neutral-200/70 bg-white px-3.5 py-3">
              <Popover.Title className="text-xs font-semibold text-neutral-900">
                Moving around the map
              </Popover.Title>
              <ul className="mt-2.5 flex flex-col gap-2">
                {MOUSE.map((step) => (
                  <li key={step.action} className="flex items-center gap-2.5">
                    <span className="bg-brand-50 text-brand-600 flex size-6 shrink-0 items-center justify-center rounded-md">
                      <step.Icon aria-hidden className="size-3.5" />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-xs font-medium text-neutral-800">{step.action}</span>
                      <span className="text-[11px] text-neutral-500">{step.how}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-2.5 pt-2.5 pb-1">
              <p className="text-[11px] font-semibold text-neutral-600">On a touch screen</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {TOUCH.map((step) => (
                  <li key={step.action} className="text-[11px] text-neutral-500">
                    <span className="font-medium text-neutral-700">{step.action}:</span> {step.how}
                  </li>
                ))}
              </ul>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** A keyboard key, drawn as a small key cap. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-4 items-center rounded border border-b-2 border-neutral-200 bg-neutral-50 px-1 font-sans text-[10px] font-medium text-neutral-700">
      {children}
    </kbd>
  );
}
