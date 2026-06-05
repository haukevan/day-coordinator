import { VendorCardSkeletonGrid } from "@/components/ui/skeletons";

export default function VendorEventVendorsLoading() {
  return (
    <div className="px-4 py-4 sm:p-6">
      <VendorCardSkeletonGrid count={4} />
    </div>
  );
}
