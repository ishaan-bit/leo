import Scene_Awakening from '@/components/scenes/Scene_Awakening';

export const metadata = {
  title: 'Awakening | Leo',
  description: 'A gentle ritual of resonance',
};

// Force dynamic rendering (required for useSession)
export const dynamic = 'force-dynamic';

export default function AwakeningPage() {
  return <Scene_Awakening />;
}
