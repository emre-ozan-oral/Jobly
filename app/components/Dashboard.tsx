"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Job, JobStatus } from "@/lib/types";
import { JOB_STATUSES } from "@/lib/types";

const STATUS_STYLES: Record<JobStatus, string> = {
  saved: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  applied: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  interviewing:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  offer:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  withdrawn: "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
};

// Row tint so a whole entry reads as its status at a glance, not just the
// badge - kept subtle (pale bg, thin left border) so text stays legible.
const STATUS_ROW_STYLES: Record<JobStatus, string> = {
  saved: "bg-zinc-50/60 border-l-zinc-300 dark:bg-zinc-800/30 dark:border-l-zinc-600",
  applied: "bg-blue-50/50 border-l-blue-300 dark:bg-blue-500/10 dark:border-l-blue-500/50",
  interviewing:
    "bg-amber-50/50 border-l-amber-300 dark:bg-amber-500/10 dark:border-l-amber-500/50",
  offer:
    "bg-emerald-50/50 border-l-emerald-300 dark:bg-emerald-500/10 dark:border-l-emerald-500/50",
  rejected: "bg-red-50/40 border-l-red-300 dark:bg-red-500/10 dark:border-l-red-500/50",
  withdrawn: "bg-zinc-50/40 border-l-zinc-300 dark:bg-zinc-800/20 dark:border-l-zinc-600",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  // Parse as a local calendar date (not UTC midnight) so the displayed day
  // never shifts backward/forward across timezones.
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type SortKey = "date" | "company" | "title" | "status";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date applied" },
  { key: "company", label: "Company" },
  { key: "title", label: "Job title" },
  { key: "status", label: "Status" },
];

const STATUS_ORDER: Record<JobStatus, number> = JOB_STATUSES.reduce(
  (acc, s, i) => ({ ...acc, [s]: i }),
  {} as Record<JobStatus, number>
);

function SortableHeader({
  label,
  columnKey,
  activeKey,
  dir,
  onClick,
}: {
  label: string;
  columnKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onClick: (key: SortKey) => void;
}) {
  const active = columnKey === activeKey;
  return (
    <th className="px-4 py-2.5 font-medium">
      <button
        onClick={() => onClick(columnKey)}
        className={`flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-300 ${active ? "text-zinc-700 dark:text-zinc-300" : ""}`}
      >
        {label}
        <span className="text-zinc-400 dark:text-zinc-500">
          {active ? (dir === "asc" ? "↑" : "↓") : ""}
        </span>
      </button>
    </th>
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

const formFromJob = (job: Job): FormState => ({
  company: job.company,
  title: job.title,
  url: job.url,
  location: job.location ?? "",
  appliedDate: job.appliedDate,
  status: job.status,
  salary: job.salary ?? "",
  notes: job.notes ?? "",
});

const inputClass =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500";

function AddJobModal({
  job,
  onClose,
  onSaved,
}: {
  job?: Job;
  onClose: () => void;
  onSaved: (job: Job) => void;
}) {
  const editing = !!job;
  const [mode, setMode] = useState<"manual" | "paste">(editing ? "manual" : "paste");
  const [form, setForm] = useState<FormState>(job ? formFromJob(job) : emptyForm());
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
      const res = await fetch(editing ? `/api/jobs/${job!.id}` : "/api/jobs", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("save failed");
      const data = await res.json();
      onSaved(data.job);
      onClose();
    } catch {
      setError(
        editing
          ? "Couldn't save your changes. Try again."
          : "Couldn't save the job. Try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">
            {editing ? "Edit application" : "Add application"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {!editing && (
          <div className="flex gap-1 px-5 pt-4">
            <button
              onClick={() => setMode("paste")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                mode === "paste"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              Paste job text
            </button>
            <button
              onClick={() => setMode("manual")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                mode === "manual"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              Manual entry
            </button>
          </div>
        )}

        <div className="space-y-3 px-5 py-4">
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </p>
          )}

          {mode === "paste" ? (
            <>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
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
                className={inputClass}
              />
              <textarea
                placeholder="Paste the job title, company, and description here..."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={8}
                className={inputClass}
              />
              <button
                onClick={handleParse}
                disabled={parsing || !pasteText}
                className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
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
                className={`col-span-1 ${inputClass}`}
              />
              <input
                placeholder="Job title *"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={`col-span-1 ${inputClass}`}
              />
              <input
                placeholder="Job posting URL *"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className={`col-span-2 ${inputClass}`}
              />
              <input
                placeholder="Location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className={`col-span-1 ${inputClass}`}
              />
              <input
                placeholder="Salary (optional)"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
                className={`col-span-1 ${inputClass}`}
              />
              <label className="col-span-1 flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                Applied on
                <input
                  type="date"
                  value={form.appliedDate}
                  onChange={(e) =>
                    setForm({ ...form, appliedDate: e.target.value })
                  }
                  className={`${inputClass} text-zinc-900 dark:text-zinc-100`}
                />
              </label>
              <label className="col-span-1 flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                Status
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as JobStatus })
                  }
                  className={`${inputClass} text-zinc-900 capitalize dark:text-zinc-100`}
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
                className={`col-span-2 ${inputClass}`}
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="col-span-2 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                {saving
                  ? "Saving..."
                  : editing
                    ? "Save changes"
                    : "Save application"}
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
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const refreshingRef = useRef(false);
  const refreshAgainRef = useRef(false);
  // Per-job pending notes edits, flushed to the API on a short debounce so
  // we don't fire a PATCH on every keystroke.
  const notesTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
    const rows = jobs.filter((j) => {
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

    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date":
          cmp = a.appliedDate.localeCompare(b.appliedDate);
          break;
        case "company":
          cmp = a.company.localeCompare(b.company, undefined, {
            sensitivity: "base",
          });
          break;
        case "title":
          cmp = a.title.localeCompare(b.title, undefined, {
            sensitivity: "base",
          });
          break;
        case "status":
          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          break;
      }
      return cmp * dir;
    });
  }, [jobs, filter, q, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  }

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

  function updateNotes(id: string, notes: string) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, notes } : j)));
    clearTimeout(notesTimers.current[id]);
    notesTimers.current[id] = setTimeout(() => {
      fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
    }, 600);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobly</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {jobs.length} application{jobs.length === 1 ? "" : "s"} tracked
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-zinc-400 sm:inline dark:text-zinc-500">
            {userEmail}
          </span>
          <a
            href="/settings"
            className="text-sm text-zinc-500 hover:text-zinc-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Extension setup
          </a>
          <button
            onClick={signOut}
            className="text-sm text-zinc-500 hover:text-zinc-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Sign out
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
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
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800 dark:hover:bg-zinc-800"
            }`}
          >
            {s} ({counts[s] ?? 0})
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            Sort by
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            title={sortDir === "asc" ? "Ascending" : "Descending"}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company, title, notes..."
            className="min-w-[220px] rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No applications yet. Click &ldquo;Add application&rdquo; or use the
            Jobly browser extension while you&apos;re on a job posting.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-500">
                <SortableHeader
                  label="Company / Title"
                  columnKey="company"
                  activeKey={sortKey}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <th className="px-4 py-2.5 font-medium dark:text-zinc-500">Location</th>
                <SortableHeader
                  label="Applied"
                  columnKey="date"
                  activeKey={sortKey}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <SortableHeader
                  label="Status"
                  columnKey="status"
                  activeKey={sortKey}
                  dir={sortDir}
                  onClick={toggleSort}
                />
                <th className="px-4 py-2.5 font-medium">Notes</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => (
                <tr
                  key={job.id}
                  className={`border-b border-l-4 border-zinc-100 last:border-b-0 hover:brightness-[0.98] dark:border-zinc-800 dark:hover:brightness-110 ${STATUS_ROW_STYLES[job.status]}`}
                >
                  <td className="px-4 py-3">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {job.title}
                    </a>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{job.company}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {job.location || "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                    {formatDate(job.appliedDate)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={job.status}
                      onChange={(e) =>
                        updateStatus(job.id, e.target.value as JobStatus)
                      }
                      className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[job.status]}`}
                    >
                      {JOB_STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-white text-zinc-900">
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      value={job.notes ?? ""}
                      onChange={(e) => updateNotes(job.id, e.target.value)}
                      placeholder="Add a note…"
                      className="w-full min-w-[160px] rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-zinc-700 placeholder:text-zinc-400 hover:border-zinc-200 focus:border-zinc-300 focus:bg-white focus:outline-none dark:text-zinc-300 dark:placeholder:text-zinc-600 dark:hover:border-zinc-700 dark:focus:border-zinc-600 dark:focus:bg-zinc-800"
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 capitalize dark:text-zinc-500">
                    {job.source}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditingJob(job)}
                      className="text-xs text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                    >
                      Edit
                    </button>
                    <span className="mx-1.5 text-zinc-200 dark:text-zinc-700">|</span>
                    <button
                      onClick={() => removeJob(job.id)}
                      className="text-xs text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
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
          onSaved={(job) => setJobs((prev) => [job, ...prev])}
        />
      )}

      {editingJob && (
        <AddJobModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSaved={(job) =>
            setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)))
          }
        />
      )}
    </div>
  );
}
