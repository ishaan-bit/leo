'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Scene_Reflect from '@/components/scenes/Scene_Reflect';

export default function ReflectPage() {
  const params = useParams();
  const pigId = params.pigId as string;
  const [pigName, setPigName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPigName() {
      try {
        const response = await fetch(`/api/pig/${pigId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.name) {
            setPigName(data.name);
          } else {
            setPigName(null);
          }
        } else {
          setPigName(null);
        }
      } catch (error) {
        console.error('Failed to fetch pig name:', error);
        setPigName(null);
      } finally {
        setLoading(false);
      }
    }

    if (pigId) {
      fetchPigName();
    }
  }, [pigId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center">
        <div className="text-pink-800 text-lg font-serif italic">Loading...</div>
      </div>
    );
  }

  if (!pigName) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-pink-800 text-lg font-serif italic">
            Could not load your companion...
          </p>
          <a 
            href={`/p/${pigId}`}
            className="text-pink-600 hover:text-pink-800 underline text-sm"
          >
            Start from the beginning
          </a>
        </div>
      </div>
    );
  }

  return <Scene_Reflect pigId={pigId} pigName={pigName} />;
}
