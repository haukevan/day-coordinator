import { TaskRowSkeletonList } from "@/components/ui/skeletons";

export default function VendorTimelineLoading() {
  return (
    <div className="px-4 py-4 sm:p-6">
      <TaskRowSkeletonList count={6} />
    </div>
  );
}
