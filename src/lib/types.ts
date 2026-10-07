export type ApptStatus =
  | "scheduled" | "confirmed" | "arrived" | "waiting"
  | "in_progress" | "completed" | "cancelled" | "no_show";

export interface Provider { id: string; name: string; short: string; specialty: string; status: "Active" | "On leave"; serviceIds: string[]; locationIds: string[]; hours: string; color: string }
export interface Service { id: string; name: string; category: string; duration: number; providerIds: string[]; locationIds: string[]; status: "Active" | "Inactive" }
export interface Location { id: string; name: string; address: string; phone: string; status: "Open" | "Closed" }
export interface Room { id: string; name: string; locationId: string; type: string; availability: string }
export interface AppUser { id: string; name: string; email: string; role: "Owner" | "Practice manager" | "Provider" | "Front desk" | "Staff"; status: "Active" | "Invited" }

export interface Patient {
  id: string; first: string; last: string; dob: string; phone: string; email: string;
  gender?: string; address?: string; emergency?: string; providerId?: string; notes?: string;
  status: "Active" | "Inactive" | "New";
}
export interface Appointment {
  id: string; patientId: string; providerId: string; serviceId: string;
  date: string; time: string; duration: number; locationId: string; roomId: string;
  status: ApptStatus; notes?: string; arrivedAt?: number; visitId?: string;
}
export interface PlotPoint { id: string; x: number; y: number; product: string; units: number; note: string }
export interface TreatmentLine { id: string; service: string; area: string; product: string; units: number; notes: string }
export interface Visit {
  id: string; patientId: string; apptId?: string; providerId: string; type: string; date: string;
  status: "In progress" | "Completed";
  reason: string;
  notes: { subjective: string; objective: string; assessment: string; plan: string };
  treatments: TreatmentLine[];
  plot: PlotPoint[];
  forms: { id: string; name: string; kind: "Consent" | "Clinical form" | "Document"; signed: boolean }[];
  photos: { id: string; stage: "Before" | "During" | "After"; label: string }[];
  followUpInstructions: string;
  followUpRecommended: string;
}
export type FollowUpType = "Post-treatment" | "Routine review" | "Treatment continuation" | "Recall" | "Other";
export interface FollowUp {
  id: string; patientId: string; visitId?: string; type: FollowUpType; due: string;
  assignee: string; status: "Open" | "Completed"; note?: string;
}
export interface Notification { id: string; text: string; time: string; read: boolean; href: string }
