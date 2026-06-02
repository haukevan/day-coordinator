import { BriefcaseBusiness } from "lucide-react";

export default function VendorsPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <BriefcaseBusiness className="size-6 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Vendors</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Manage your vendor contacts. Add, edit, and organize vendors you work
          with across all your events.
        </p>
      </div>
    </div>
  );
}
