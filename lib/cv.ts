import type { SupabaseClient } from "@supabase/supabase-js";

export interface CvProfile {
  fileName: string | null;
  skills: string[];
  yearsExperience: number | null;
  targetSeniority: string | null;
  updatedAt: string;
}

export interface CvProfileInput {
  fileName?: string | null;
  rawText?: string | null;
  skills: string[];
  yearsExperience?: number | null;
  targetSeniority?: string | null;
}

const SELECT_COLUMNS =
  "fileName:file_name, skills, yearsExperience:years_experience, targetSeniority:target_seniority, updatedAt:updated_at";

export async function getCvProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<CvProfile | undefined> {
  const { data, error } = await supabase
    .from("cv_profile")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as CvProfile) ?? undefined;
}

/**
 * One row per user, so saving a new CV always replaces the previous one -
 * there's only ever "your current CV", not a history of past uploads.
 */
export async function upsertCvProfile(
  supabase: SupabaseClient,
  userId: string,
  input: CvProfileInput
): Promise<CvProfile> {
  const { data, error } = await supabase
    .from("cv_profile")
    .upsert(
      {
        user_id: userId,
        file_name: input.fileName?.trim() || null,
        raw_text: input.rawText || null,
        skills: input.skills,
        years_experience: input.yearsExperience ?? null,
        target_seniority: input.targetSeniority?.trim() || null,
      },
      { onConflict: "user_id" }
    )
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as CvProfile;
}


/**
 * Partial update - used when the user edits the auto-extracted skill chips
 * or tweaks years/seniority without re-uploading the CV file. Unlike
 * upsertCvProfile, this never touches file_name/raw_text.
 */
export async function updateCvProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: {
    skills?: string[];
    yearsExperience?: number | null;
    targetSeniority?: string | null;
  }
): Promise<CvProfile | undefined> {
  const update: Record<string, unknown> = {};
  if ("skills" in patch) update.skills = patch.skills;
  if ("yearsExperience" in patch) update.years_experience = patch.yearsExperience ?? null;
  if ("targetSeniority" in patch)
    update.target_seniority = patch.targetSeniority?.trim() || null;

  const { data, error } = await supabase
    .from("cv_profile")
    .update(update)
    .eq("user_id", userId)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as CvProfile) ?? undefined;
}
