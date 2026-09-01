import type { Metadata } from "next";
import "./globals.css";
import ThemeToggle from "./components/ThemeToggle";

export const metadata: Metadata = {
  title: "Jobly - Job Application Tracker",
  description: "Track job applications with one-click capture from job postings.",
};

// Runs before React hydrates so the page never flashes the wrong theme.
// Preference is per-device (localStorage), falling back to the OS setting
// the first time a device is seen.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("jobly-theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
