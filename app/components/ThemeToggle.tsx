"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "jobly-theme";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

export default function ThemeToggle() {
  // Starts null (unknown) so we don't render a guess that flips right after
  // hydration - the inline script in layout.tsx already set the class on
  // <html> before paint, we just read it back here.
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    // One-time read of DOM state an external script (the inline snippet in
    // layout.tsx) already applied before hydration - not a value we can
    // compute during render, since the server has no `document`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Private browsing / storage disabled - theme just won't persist.
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="fixed top-4 right-4 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      {dark === null ? null : dark ? (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4.5 w-4.5">
          <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM4.22 4.22a.75.75 0 011.06 0l1.06 1.06a.75.75 0 11-1.06 1.06L4.22 5.28a.75.75 0 010-1.06zM13.66 13.66a.75.75 0 011.06 0l1.06 1.06a.75.75 0 11-1.06 1.06l-1.06-1.06a.75.75 0 010-1.06zM2 10a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 012 10zM15 10a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 0115 10zM4.22 15.78a.75.75 0 010-1.06l1.06-1.06a.75.75 0 111.06 1.06l-1.06 1.06a.75.75 0 01-1.06 0zM13.66 6.34a.75.75 0 010-1.06l1.06-1.06a.75.75 0 111.06 1.06l-1.06 1.06a.75.75 0 01-1.06 0zM10 6a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4.5 w-4.5">
          <path
            fillRule="evenodd"
            d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
}
