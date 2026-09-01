"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Job, JobStatus } from "@/lib/types";
import { JOB_STATUSES } from "@/lib/types";

const STATUS_STYLES: Record<JobStatus, string> = {
  saved: "bg-zinc-100 text-zinc-700",
  applied: "bg-blue-100 text-blue-700",
  interviewing: "bg-amber-100 text-amber-800",
  offer: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-zinc-200 text-zinc-500",
};

function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

type FormState = {
  company: string;
  title: string;
  url: string;
  location: string;
  appliedDate: string;
  status: JobStatus;
  salary: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  company: "",
  title: "",
  url: "",
  location: "",
  appliedDate: new Date().toISOString().slice(0, 10),
  status: "applied",
  salary: "",
  notes: "",
});

function AddJobModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (job: Job) => void;
}) {
  const [mode, setMode] = useState<"manual" | "paste">("paste");
  const [form, setForm] = useState<FormState>(emptyForm());
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    setParsing(true);
    setError(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: pasteUrl, text: pasteText }),
      });
      const data = await res.json();
      setForm((f) => ({
        ...f,
        title: data.parsed.title || f.title,
        company: data.parsed.company || f.company,
        location: data.parsed.location || f.location,
        salary: data.parsed.salary || f.salary,
        url: pasteUrl || f.url,
      }));
      setMode("manual");
    } catch {
      setError("Couldn't parse that text - fill in the fields manually below.");
      setMode("manual");
      setForm((f) => ({ ...f, url: pasteUrl || f.url }));
    } finally {
      setParsing(false);
    }
  }

  async function handleSave() {
    if (!form.company || !form.title || !form.url) {
      setError("Company, title, and URL are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("save failed");
      const data = await res.json();
      onCreated(data.job);
      onClose();
    } catch {
      setError("Couldn't save the job. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h2 className="text-lg font-semibold">Add application</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-1 px-5 pt-4">
          <button
            onClick={() => setMode("paste")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              mode === "paste"
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            Paste job text
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              mode === "manual"
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            Manual entry
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {mode === "paste" ? (
            <>
              <p className="text-sm text-zinc-500">
                For sites the extension can&apos;t read automatically (e.g. you&apos;re
                on a device without it) - paste the job URL and the visible
                job text (select-all on the posting and copy) and Jobly will
                guess the fields for you to review.
              </p>
              <input
                type="url"
                placeholder="Job posting URL"
                value={pasteUrl}
                onChange={(e) => setPasteUrl(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <textarea
                placeholder="Paste the job title, company, and description here..."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={8}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <button
                onClick={handleParse}
                disabled={parsing || !pasteText}
                className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {parsing ? "Parsing..." : "Extract fields →"}
              </button>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Company *"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="col-span-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Job title *"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="col-span-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Job posting URL *"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="col-span-2 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="col-span-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Salary (optional)"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
                className="col-span-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <label className="col-span-1 flex flex-col gap-1 text-xs text-zinc-500">
                Applied on
                <input
                  type="date"
                  value={form.appliedDate}
                  onChange={(e) =>
                    setForm({ ...form, appliedDate: e.target.value })
                  }
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                />
              </label>
              <label className="col-span-1 flex flex-col gap-1 text-xs text-zinc-500">
                Status
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as JobStatus })
                  }
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 capitalize"
                >
                  {JOB_STATUSES.map((s) => (
                    <option key={s} value={s} className="capitalize">
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <textarea
                placeholder="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="col-span-2 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="col-span-2 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save application"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({
  initialJobs,
  userEmail,
  userId,
}: {
  initialJobs: Job[];
  userEmail: string;
  userId: string;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [filter, setFilter] = useState<JobStatus | "all">("all");
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const refreshAgainRef = useRef(false);

  // The extension saves jobs by hitting the API directly, not through this
  // page, so this tab's `jobs` state would otherwise go stale the moment
  // you switch away to apply somewhere else. Re-pull the list on demand -
  // called both by the realtime subscription below (so a new application
  // shows up right away, even without switching tabs) and as a fallback
  // whenever the tab regains focus/visibility, in case a realtime event
  // was missed (e.g. the socket was briefly disconnected).
  const refreshJobs = useCallback(async () => {
    if (refreshingRef.current) {
      // A fetch is already in flight - make sure another one runs right
      // after it finishes, so an event that arrives mid-fetch isn't lost.
      refreshAgainRef.current = true;
      return;
    }
    refreshingRef.current = true;
    setRefreshing(true);
    do {
      refreshAgainRef.current = false;
      try {
        const res = await fetch("/api/jobs");
        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobs);
        }
      } catch {
        // Offline or a blip - the next focus/visibility event or realtime
        // message will retry.
      }
    } while (refreshAgainRef.current);
    refreshingRef.current = false;
    setRefreshing(false);
  }, []);

  useEffect(() => {
    function onFocusOrVisible() {
      if (document.visibilityState === "hidden") return;
      refreshJobs();
    }
    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);
    return () => {
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
    };
  }, [refreshJobs]);

  // Live updates: the extension writes straight to the database, so a
  // Postgres change notification is what makes a newly-applied job appear
  // immediately instead of waiting for you to switch back to this tab.
  // Requires the `jobs` table to be added to the `supabase_realtime`
  // publication (supabase/schema.sql does this).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`jobs-changes-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jobs",
          filter: `user_id=eq.${userId}`,
        },
        () => refreshJobs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refreshJobs]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (filter !== "all" && j.status !== filter) return false;
      if (
        q &&
        !`${j.company} ${j.title} ${j.notes ?? ""}`
          .toLowerCase()
          .includes(q.toLowerCase())
      )
        return false;
      return true;
    });
  }, [jobs, filter, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: jobs.length };
    for (const s of JOB_STATUSES) c[s] = jobs.filter((j) => j.status === s).length;
    return c;
  }, [jobs]);

  async function updateStatus(id: string, status: JobStatus) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)));
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function removeJob(id: string) {
    if (!confirm("Delete this application?")) return;
    setJobs((prev) => prev.filter((j) => j.id !== id));
    await fetch(`/api/jobs/${id}`, { method: "DELETE" });
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobly</h1>
          <p className="text-sm text-zinc-500">
            {jobs.length} application{jobs.length === 1 ? "" : "s"} tracked
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-zinc-400 sm:inline">
            {userEmail}
          </span>
          <a
            href="/settings"
            className="text-sm text-zinc-500 hover:text-zinc-700 hover:underline"
          >
            Extension setup
          </a>
          <button
            onClick={refreshJobs}
            disabled={refreshing}
            className="text-sm text-zinc-500 hover:text-zinc-700 hover:underline disabled:opacity-50"
            title="Refresh (the list also updates automatically when you switch back to this tab)"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={signOut}
            className="text-sm text-zinc-500 hover:text-zinc-700 hover:underline"
          >
            Sign out
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            + Add application
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", ...JOB_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              filter === s
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100"
            }`}
          >
            {s} ({counts[s] ?? 0})
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search company, title, notes..."
          className="ml-auto min-w-[220px] rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-200">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            No applications yet. Click &ldquo;Add application&rdquo; or use the
            Jobly browser extension while you&apos;re on a job posting.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-2.5 font-medium">Company / Title</th>
                <th className="px-4 py-2.5 font-medium">Location</th>
                <th className="px-4 py-2.5 font-medium">Applied</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => (
                <tr key={job.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {job.title}
                    </a>
                    <div className="text-xs text-zinc-500">{job.company}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {job.location || "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {job.appliedDate}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={job.status}
                      onChange={(e) =>
                        updateStatus(job.id, e.target.value as JobStatus)
                      }
                      className="rounded-md border-0 bg-transparent text-xs font-medium capitalize"
                    >
                      {JOB_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <div className="mt-0.5">
                      <StatusBadge status={job.status} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 capitalize">
                    {job.source}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => removeJob(job.id)}
                      className="text-xs text-zinc-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <AddJobModal
          onClose={() => setShowAdd(false)}
          onCreated={(job) => setJobs((prev) => [job, ...prev])}
        />
      )}
    </div>
  );
}
