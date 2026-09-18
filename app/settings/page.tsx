import { randomBytes } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import TokenPanel from "./TokenPanel";

export const dynamic = "force-dynamic";

async function getOrCreateToken(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("api_tokens")
    .select("token")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing.token;

  const token = randomBytes(24).toString("hex");
  await admin.from("api_tokens").insert({ user_id: userId, token });
  return token;
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const token = await getOrCreateToken(user.id);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
        ← Back
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Extension setup
      </h1>

      <div className="mt-6 space-y-4 rounded-lg bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div>
          <h2 className="font-medium">1. Load the extension</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            In Chrome, go to <code className="dark:text-zinc-300">chrome://extensions</code>, enable
            &ldquo;Developer mode&rdquo;, click &ldquo;Load unpacked&rdquo;, and select the{" "}
            <code className="dark:text-zinc-300">extension/</code> folder from this project.
          </p>
        </div>

        <div>
          <h2 className="font-medium">2. Sign in</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Click the Jobly extension icon → Options, then sign in with the
            same email and password you use here — the extension links
            straight to your account, nothing to copy or paste, and nothing
            to configure. (Running Jobly locally instead? Set your URL under
            Options → &ldquo;Advanced: Jobly URL&rdquo;.)
          </p>
        </div>

        <div>
          <h2 className="font-medium">3. Capture jobs</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Open a job posting on LinkedIn, Greenhouse, Lever, or Workday,
            click the Jobly extension icon, review the auto-filled fields,
            and click Save. Jobs saved this way land in your account -
            signing in as someone else won&apos;t see them.
          </p>
        </div>

        <div>
          <h2 className="font-medium">Advanced: personal API token</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            The extension doesn&apos;t need this anymore, but it&apos;s here if
            you&apos;re scripting against the API directly — it doesn&apos;t
            expire the way a signed-in session does. Anyone with this token
            can add jobs to your account, so treat it like a password.
          </p>
          <div className="mt-2">
            <TokenPanel initialToken={token} />
          </div>
        </div>
      </div>
    </div>
  );
}
