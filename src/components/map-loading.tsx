import { cn } from "@/lib/utils";

/** Placeholder over the map area while the map code, style or site data loads. */
export default function MapLoading({ text, failed = false }: { text: string; failed?: boolean }) {
  return (
    <div className="bg-muted/40 absolute inset-0 flex flex-col items-center justify-center gap-3">
      {!failed && (
        <span
          className="border-muted-foreground/30 border-t-primary size-6 animate-spin rounded-full border-2"
          aria-hidden
        />
      )}
      <p className={cn("text-sm", failed ? "text-destructive" : "text-muted-foreground")}>{text}</p>
    </div>
  );
}
