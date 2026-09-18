import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCvProfile, upsertCvProfile, updateCvProfile } from "@/lib/cv";
import { extractTechStack } from "@/lib/techStack";

/**
 * CV profile: one upload, parsed server-side (no LLM call - same fixed
 * keyword list the extension uses on job postings, see lib/techStack.ts),
 * used to compute a local match score in the extension popup.
 *
 * Auth is dual, same pattern as /api/capture:
 *  - Authorization: Bearer <token> - the extension, reading the profile to
 *    compute a match score. Resolved via the admin client (a bearer token
 *    could be a Supabase session OR a personal API token, so we can't rely
 *    on RLS/cookies here) with every query explicitly scoped to that
 *    resolved user_id.
 *  - Session cookie - the web dashboard's own Settings page, uploading or
 *    editing the CV. Uses the request-scoped client so RLS applies.
 */
async function resolveUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (token) {
    const admin = createAdminClient();
    const { data: jwtUser } = await admin.auth.getUser(token);
    if (jwtUser?.user) return jwtUser.user.id;

    const { data: tokenRow } = await admin
      .from("api_tokens")
      .select("user_id")
      .eq("token", token)
      .maybeSingle();
    if (tokenRow) return tokenRow.user_id as string;

    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB - CVs are small; this is generous

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = (file.name || "").toLowerCase();
  const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";
  const isDocx =
    name.endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (isPdf) {
    // pdf-parse v2 API: a class you instantiate per document, not a bare
    // function - dynamic import keeps this (and pdfjs underneath it) out
    // of routes that don't need it.
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text || "";
    } finally {
      await parser.destroy();
    }
  }

  if (isDocx) {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  throw new Error("Unsupported file type - upload a .pdf or .docx");
}

/** Returns the caller's CV profile (or null if none uploaded yet). */
export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const profile = await getCvProfile(admin, userId);
  return NextResponse.json({ profile: profile ?? null });
}

/** Uploads (or replaces) the caller's CV. Web dashboard only. */
export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "file is too large (max 8MB)" }, { status: 400 });
  }

  const yearsRaw = form.get("yearsExperience");
  const yearsExperience =
    typeof yearsRaw === "string" && yearsRaw.trim() !== "" ? Number(yearsRaw) : null;
  const targetSeniorityRaw = form.get("targetSeniority");
  const targetSeniority =
    typeof targetSeniorityRaw === "string" ? targetSeniorityRaw : null;

  let text: string;
  try {
    text = await extractText(file);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "couldn't parse file" },
      { status: 400 }
    );
  }

  const skills = extractTechStack(text);

  const admin = createAdminClient();
  const profile = await upsertCvProfile(admin, userId, {
    fileName: file.name,
    rawText: text,
    skills,
    yearsExperience,
    targetSeniority,
  });

  return NextResponse.json({ profile });
}

/**
 * Edits the current profile without re-uploading a file - used when the
 * user corrects the auto-extracted skill chips, or changes years/seniority.
 */
export async function PATCH(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const patch: {
    skills?: string[];
    yearsExperience?: number | null;
    targetSeniority?: string | null;
  } = {};
  if (Array.isArray(body.skills)) {
    patch.skills = body.skills.filter((s: unknown) => typeof s === "string");
  }
  if ("yearsExperience" in body) {
    patch.yearsExperience =
      body.yearsExperience === null || body.yearsExperience === ""
        ? null
        : Number(body.yearsExperience);
  }
  if ("targetSeniority" in body) {
    patch.targetSeniority = body.targetSeniority || null;
  }

  const admin = createAdminClient();
  const profile = await updateCvProfile(admin, userId, patch);
  if (!profile) {
    return NextResponse.json({ error: "no CV on file yet" }, { status: 404 });
  }
  return NextResponse.json({ profile });
}
