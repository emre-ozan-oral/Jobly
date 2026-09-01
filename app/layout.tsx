import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jobly - Job Application Tracker",
  description: "Track job applications with one-click capture from job postings.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        {children}
      </body>
    </html>
  );
}
