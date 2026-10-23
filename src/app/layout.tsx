import type { Metadata } from 'next';
import { z } from 'zod';
import './globals.css';

const metadataBase = new URL(
  z.string().url().default('http://localhost:3000').parse(process.env.APP_URL),
);

export const metadata: Metadata = {
  metadataBase,
  title: 'Holbo — Аялахдаа үргэлж холбоотой',
  description: 'Монгол аялагчдад зориулсан eSIM үйлчилгээ.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn">
      <body>{children}</body>
    </html>
  );
}
