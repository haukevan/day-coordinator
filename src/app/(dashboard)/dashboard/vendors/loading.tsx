import { Skeleton } from "@/components/ui/skeleton";
import { VendorCardSkeletonGrid } from "@/components/ui/skeletons";

export default function VendorsLoading() {
  return (
    <div className="space-y-6 px-4 py-5 sm:p-6">
      {/* Header */}
      <Skeleton className="h-8 w-28 rounded-md" />
      {/* Vendor cards */}
      <VendorCardSkeletonGrid count={6} />
    </div>
  );
}
