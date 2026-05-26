export type SerializedTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  durationMins: number | null;
  manualOverride: boolean;
  parentTaskId: string | null;
  publicVisibility: boolean;
  eventId: string;
  createdAt: string;
  updatedAt: string;
};
