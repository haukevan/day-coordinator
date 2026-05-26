export function TimelineGantt() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 py-20 text-center">
      <div className="mb-5 w-52 space-y-1.5 opacity-25">
        {[{ w: "80%", ml: "0%" }, { w: "100%", ml: "0%" }, { w: "60%", ml: "15%" }, { w: "85%", ml: "5%" }].map(
          (bar, i) => (
            <div
              key={i}
              className="h-5 rounded-md bg-primary"
              style={{ width: bar.w, marginLeft: bar.ml }}
            />
          )
        )}
      </div>
      <p className="mb-1 text-sm font-medium text-foreground">Gantt view</p>
      <p className="text-xs text-muted-foreground">Coming in the next update.</p>
    </div>
  );
}
