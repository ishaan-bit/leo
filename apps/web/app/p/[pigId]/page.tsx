import { Metadata } from 'next';
import PigRitualBlock from '@/components/organisms/PigRitualBlock';

interface PigPageProps {
  params: Promise<{ pigId: string }>;
}

export async function generateMetadata({ params }: PigPageProps): Promise<Metadata> {
  return {
    title: 'Name Me',
    description: 'A liminal naming ritual for your winged pig.',
    robots: 'noindex',
  };
}

export default async function PigPage({ params }: PigPageProps) {
  const { pigId } = await params;

  // Fetch pig data from API to check if already named
  let pig = null;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://localhost:3000';
    const res = await fetch(`${baseUrl}/api/pig/${pigId}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      pig = await res.json();
    }
  } catch (error) {
    console.error('Failed to fetch pig data:', error);
  }

  return (
    <main className="min-h-screen-mobile flex items-center justify-center px-6 py-12">
      <PigRitualBlock pigId={pigId} initialName={pig?.name || null} />
    </main>
  );
}
