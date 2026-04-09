import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OneApp Web',
  description: 'Target-state customer web app migration slice for OneApp.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
