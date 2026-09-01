import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job, JobInput, JobStatus } from "./types";

// Every read selects the same column list, aliased from the DB's
// snake_case names to the app's camelCase Job type.
const SELECT_COLUMNS =
  "id, company, title, url, source, location, appliedDate:applied_date, status, notes, salary, createdAt:created_at, updatedAt:updated_at";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function listJobs(
  supabase: SupabaseClient,
  userId: string,
  filter?: { status?: JobStatus; q?: string }
): Promise<Job[]> {
  let query = supabase
    .from("jobs")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .order("applied_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filter?.status) query = query.eq("status", filter.status);
  if (filter?.q) {
    const q = filter.q.replace(/[%_]/g, "");
    query = query.or(
      `company.ilike.%${q}%,title.ilike.%${q}%,notes.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Job[];
}

export async function getJob(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<Job | undefined> {
  const { data, error } = await supabase
    .from("jobs")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Job) ?? undefined;
}

export async function findByUrl(
  supabase: SupabaseClient,
  userId: string,
  url: string
): Promise<Job | undefined> {
  const { data, error } = await supabase
    .from("jobs")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("url", url)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Job) ?? undefined;
}

export async function createJob(
  supabase: SupabaseClient,
  userId: string,
  input: JobInput
): Promise<Job> {
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: userId,
      company: input.company.trim(),
      title: input.title.trim(),
      url: input.url.trim(),
      source: input.source?.trim() || "manual",
      location: input.location?.trim() || null,
      applied_date: input.appliedDate || todayIso(),
      status: input.status || "applied",
      notes: input.notes?.trim() || null,
      salary: input.salary?.trim() || null,
    })
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as Job;
}

export async function updateJob(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<JobInput>
): Promise<Job | undefined> {
  const update: Record<string, string | null> = {};
  if ("company" in patch) update.company = patch.company!.trim();
  if ("title" in patch) update.title = patch.title!.trim();
  if ("url" in patch) update.url = patch.url!.trim();
  if ("source" in patch) update.source = patch.source || "manual";
  if ("location" in patch) update.location = patch.location?.trim() || null;
  if ("appliedDate" in patch)
    update.applied_date = patch.appliedDate || todayIso();
  if ("status" in patch) update.status = patch.status!;
  if ("notes" in patch) update.notes = patch.notes?.trim() || null;
  if ("salary" in patch) update.salary = patch.salary?.trim() || null;

  const { data, error } = await supabase
    .from("jobs")
    .update(update)
    .eq("user_id", userId)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Job) ?? undefined;
}

export async function deleteJob(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("jobs")
    .delete()
    .eq("user_id", userId)
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
