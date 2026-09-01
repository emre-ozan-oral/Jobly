export type JobStatus =
  | "saved"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "withdrawn";

export const JOB_STATUSES: JobStatus[] = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
];

export interface Job {
  id: string;
  company: string;
  title: string;
  url: string;
  source: string;
  location: string | null;
  appliedDate: string; // ISO date (YYYY-MM-DD)
  status: JobStatus;
  notes: string | null;
  salary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobInput {
  company: string;
  title: string;
  url: string;
  source?: string;
  location?: string | null;
  appliedDate?: string | null;
  status?: JobStatus;
  notes?: string | null;
  salary?: string | null;
}
