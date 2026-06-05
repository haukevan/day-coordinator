import { Skeleton } from "@/components/ui/skeleton";

/** Single form field skeleton: label + input area */
export function FormFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  );
}

/** Multi-line form field skeleton (e.g., textarea) */
export function FormTextareaSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-24 w-full rounded-md" />
    </div>
  );
}

/** Full settings form skeleton */
export function SettingsFormSkeleton() {
  return (
    <div className="space-y-6 px-4 py-5 sm:p-6">
      <Skeleton className="h-6 w-32" />
      <FormFieldSkeleton />
      <FormTextareaSkeleton />
      <FormFieldSkeleton />
      <FormFieldSkeleton />
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>
    </div>
  );
}
