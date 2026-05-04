import type { Metadata } from "next";
import { Inter, Cinzel } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "IronAtlas",
  description: "Forge your character. Train every muscle.",
};

/**
 * Inlined into <head> so the theme class is on <html> before first
 * paint — no flash of the wrong theme on reload. Reads localStorage,
 * defaults to dark-fantasy.
 */
const noFlashScript = `
(function(){
  try {
    var t = localStorage.getItem('ironatlas.theme');
    if (t !== 'light-fantasy' && t !== 'dark-fantasy') t = 'dark-fantasy';
    var c = document.documentElement.classList;
    c.add(t);
    if (t === 'light-fantasy') c.remove('dark-fantasy');
    else c.remove('light-fantasy');
  } catch (e) {
    document.documentElement.classList.add('dark-fantasy');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${cinzel.variable}`}>
      <head>
        <script
          // The script is short, inline, and statically defined — safe.
          dangerouslySetInnerHTML={{ __html: noFlashScript }}
        />
      </head>
      <body className="min-h-screen bg-bg text-ink font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
