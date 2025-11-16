import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'A QuietDen Experience',
  description: 'A QuietDen Experience',
  openGraph: {
    title: 'A QuietDen Experience',
    description: 'A QuietDen Experience',
  },
};

export default function QDMomentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
