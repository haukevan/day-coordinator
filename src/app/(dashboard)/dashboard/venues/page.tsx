import { MapPin } from "lucide-react";

export default function VenuesPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <MapPin className="size-6 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Venues</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Manage your saved venues. Add locations with addresses, contact info,
          and maps to use across your events.
        </p>
      </div>
    </div>
  );
}
