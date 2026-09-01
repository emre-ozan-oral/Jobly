import { NextRequest, NextResponse } from "next/server";
import { parseJobInput } from "@/lib/parse";

/**
 * Paste-based fallback for sites the extension doesn't have a scraper for
 * (or when you're on a device without the extension). Paste the job
 * description text - and optionally the raw page HTML, e.g. saved via
 * "View Page Source" - along with the URL, and this returns a best-guess
 * at company/title/location/salary for you to review before saving.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const parsed = parseJobInput({
    url: body.url,
    html: body.html,
    text: body.text,
  });
  return NextResponse.json({ parsed });
}
