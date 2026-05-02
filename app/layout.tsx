import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IronAtlas",
  description: "Visual workout tracker — train every muscle.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-gray-100 font-sans">{children}</body>
    </html>
  );
}
