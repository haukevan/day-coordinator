export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-6xl">📡</div>
      <h1 className="text-2xl font-semibold text-foreground">
        You&apos;re offline
      </h1>
      <p className="max-w-sm text-muted-foreground">
        Check your connection and try again. Your event timeline is available
        offline once it has been loaded.
      </p>
    </div>
  );
}
