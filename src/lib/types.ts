export type TaskVendorRef = {
  eventVendorId: string;
  eventVendor: {
    id: string;
    company: string | null;
    jobTitle: string | null;
    vendorContact: {
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
  };
};

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
  delayAmountMins: number | null;
  manualOverride: boolean;
  sequenceLabel: string | null;
  parentTaskId: string | null;
  parentTask?: { id: string; title: string } | null;
  publicVisibility: boolean;
  eventId: string;
  assignedToId: string | null;
  taskVendors?: TaskVendorRef[];
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
  role: string;
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

export type SerializedVendorContactWithEvents = SerializedVendorContact & {
  events?: LinkedEvent[];
  _count?: { eventVendors: number };
};

export type SerializedVenue = {
  id: string;
  name: string;
  address: string;
  description: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  events?: LinkedEvent[];
  _count?: { events: number };
};

export type LinkedEvent = {
  id: string;
  title: string;
  status: string;
};

// ─── SubTask Types ────────────────────────────────────────────────────────────

export type SubTaskVendorRef = {
  eventVendorId: string;
  eventVendor: {
    id: string;
    company: string | null;
    jobTitle: string | null;
    vendorContact: {
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
  };
};

export type SerializedSubTask = {
  id: string;
  taskId: string;
  title: string;
  status: string; // NOT_STARTED | IN_PROGRESS | COMPLETED
  sortOrder: number;
  subTaskVendors?: SubTaskVendorRef[];
  completedById?: string | null;
  completedByName?: string | null;
  completedBy?: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

// ─── Dashboard / Shared Query Types ──────────────────────────────────────────

export type DashboardVenueChip = {
  id: string;
  name: string;
  address: string;
  description: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
};

export type DashboardEvent = {
  id: string;
  title: string;
  eventDate: string | null;
  status: "DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED" | "ARCHIVED";
  createdAt?: string;
  _count: { tasks: number };
  venue: DashboardVenueChip | null;
};

export type DashboardPerson = {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string | null;
};

export type DashboardPendingInvite = {
  id: string;
  inviteToken: string | null;
  invitedBy: DashboardPerson | null;
  event: {
    id: string;
    title: string;
    eventDate: string | null;
    owner: DashboardPerson;
  };
};

export type DashboardVendorMembership = {
  id: string;
  event: {
    id: string;
    title: string;
    eventDate: string | null;
    status: string;
    owner: DashboardPerson;
  };
};

export type DashboardPayload = {
  events: DashboardEvent[];
  pendingInvites: DashboardPendingInvite[];
  vendorMemberships: DashboardVendorMembership[];
};

export type Profile = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  phone: string | null;
  onboarded: boolean;
};

export type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  timezone: string;
  slug: string | null;
  status: "DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED" | "ARCHIVED";
  publicTimeline: boolean;
  venueId: string | null;
  updatedAt?: string;
};
