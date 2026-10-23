import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
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
