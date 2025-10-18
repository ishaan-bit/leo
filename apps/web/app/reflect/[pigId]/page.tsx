import { redirect } from 'next/navigation';

interface ReflectPageProps {
  params: { pigId: string };
}

/**
 * Legacy reflect page - server-side redirect to awakening scene
 * This route is deprecated in favor of the new awakening ritual
 */
export default function ReflectPage({ params }: ReflectPageProps) {
  // Server-side redirect
  redirect('/awakening');
}
