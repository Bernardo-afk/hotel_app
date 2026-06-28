export type Role = 'CLEANER' | 'COORDINATOR' | 'ADM' | 'MANAGER' | 'SUPER_ADMIN';
export type UrgencyLevel = 'RED' | 'YELLOW' | 'GREEN';
export type CleaningJobStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'PARTIAL' | 'STAND_BY' | 'BLOCKED' | 'DONE' | 'CANCELLED';
export type AssignmentStatus = 'NOTIFIED' | 'IN_PROGRESS' | 'DONE';
export type TransportType = 'UBER' | 'NOVENTA_E_NOVE' | 'ONIBUS' | 'METRO' | 'OUTRO';
export type IncidentType = 'BROKEN' | 'STAINED' | 'INFRASTRUCTURE' | 'LOST_ITEM';

export interface Property {
  id: string;
  unitNumber: string;
  address: string;
  lat: number;
  lng: number;
  condominium: { id: string; name: string };
}

export interface CleaningJob {
  id: string;
  status: CleaningJobStatus;
  urgencyLevel: UrgencyLevel;
  urgency: UrgencyLevel | null;
  scheduledDate: string;
  property: Property;
  reservation?: { checkIn: string; checkOut: string } | null;
  assignments: Array<{ id: string; cleanerId: string; status: AssignmentStatus }>;
}

export interface AuthUser {
  id: string;
  name: string;
  role: Role;
  phone: string;
}
