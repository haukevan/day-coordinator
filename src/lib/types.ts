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
  parentTask?: { id: string; title: string } | null;
  publicVisibility: boolean;
  eventId: string;
  assignedToId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedVendor = {
  id: string;
  eventId: string;
  vendorContactId: string;
  userId: string | null;
  isEventOwner: boolean;
  company: string | null;
  jobTitle: string | null;
  status: string;
  inviteSentAt: string | null;
  joinedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // VendorContact fields (flattened)
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
};

export type SerializedVendorContact = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
};
