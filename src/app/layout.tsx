import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fishing Spot — AI Spatial Grid Angler Advisor & Community',
  description:
    'Discover fishing water bodies across Poland, Spain, and Europe. Unlock AI spatial grid spot recommendations, restriction checks, and community catch reports.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
