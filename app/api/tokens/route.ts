import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function generateToken(): string {
  return randomBytes(24).toString("hex");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Returns the caller's personal API token, creating one on first use.
 * Writes go through the admin client because api_tokens has no
 * client-facing insert/update policy - only /api/tokens (which has
 * already authenticated the caller via their session cookie above) is
 * allowed to mint or rotate a token, and always for req.user's own id.
 */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("api_tokens")
    .select("token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ token: existing.token });

  const token = generateToken();
  const { error } = await admin
    .from("api_tokens")
    .insert({ user_id: user.id, token });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ token });
}

/** Rotates the caller's token, invalidating the old one. */
export async function POST() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const token = generateToken();
  const { error } = await admin
    .from("api_tokens")
    .upsert({ user_id: user.id, token }, { onConflict: "user_id" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ token });
}
