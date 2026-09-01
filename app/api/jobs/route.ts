import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createJob, listJobs } from "@/lib/jobs";
import type { JobStatus } from "@/lib/types";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as JobStatus | null;
  const q = searchParams.get("q");

  const jobs = await listJobs(supabase, user.id, {
    status: status || undefined,
    q: q || undefined,
  });
  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.company || !body.title || !body.url) {
    return NextResponse.json(
      { error: "company, title, and url are required" },
      { status: 400 }
    );
  }
  const job = await createJob(supabase, user.id, body);
  return NextResponse.json({ job }, { status: 201 });
}
