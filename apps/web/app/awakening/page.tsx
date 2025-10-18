import { redirect } from 'next/navigation';

/**
 * Legacy awakening route - redirects to home
 * This route is no longer used
 */
export default function AwakeningPage() {
  redirect('/');
}
