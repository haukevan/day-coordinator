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
