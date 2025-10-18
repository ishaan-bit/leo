'use client';

import { useState, useEffect } from 'react';

type Reflection = {
  id: string;
  owner_id: string;
  user_id: string | null;
  session_id: string;
  signed_in: boolean;
  pig_id: string;
  pig_name: string | null;
  text: string;
  valence: number | null;
  arousal: number | null;
  language: string | null;
  input_mode: string;
  time_of_day: string | null;
  created_at: string;
  device_info: any;
};

export default function AdminPage() {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'guest' | 'user'>('all');
  const [searchPigId, setSearchPigId] = useState('');

  useEffect(() => {
    fetchReflections();
  }, []);

  const fetchReflections = async () => {
    try {
      // This would need a proper admin API endpoint
      // For now, showing structure only
      setLoading(false);
    } catch (error) {
      console.error('Error fetching reflections:', error);
      setLoading(false);
    }
  };

  const filteredReflections = reflections.filter(r => {
    if (filter === 'guest' && r.signed_in) return false;
    if (filter === 'user' && !r.signed_in) return false;
    if (searchPigId && !r.pig_id.includes(searchPigId)) return false;
    return true;
  });

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
      <p className="text-gray-600">Loading reflections...</p>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Leo Admin - Reflections Database</h1>
        
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by type</label>
              <select 
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500"
              >
                <option value="all">All Reflections</option>
                <option value="guest">Guest Only</option>
                <option value="user">Signed-in Only</option>
              </select>
            </div>
            
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search by Pig ID</label>
              <input
                type="text"
                value={searchPigId}
                onChange={(e) => setSearchPigId(e.target.value)}
                placeholder="Enter pig ID..."
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500"
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total Reflections</p>
            <p className="text-2xl font-bold text-gray-900">{reflections.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Guest Reflections</p>
            <p className="text-2xl font-bold text-gray-900">
              {reflections.filter(r => !r.signed_in).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">User Reflections</p>
            <p className="text-2xl font-bold text-gray-900">
              {reflections.filter(r => r.signed_in).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Avg Valence</p>
            <p className="text-2xl font-bold text-gray-900">
              {reflections.length > 0 
                ? (reflections.reduce((sum, r) => sum + (r.valence || 0), 0) / reflections.length).toFixed(2)
                : '0.00'}
            </p>
          </div>
        </div>

        {/* Reflections Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pig
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Text Preview
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Signals
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Device
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReflections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <p className="text-lg mb-2">No reflections yet</p>
                    <p className="text-sm">Visit <code className="bg-gray-100 px-2 py-1 rounded">https://localhost:3000/p/testpig</code> and write a reflection</p>
                  </td>
                </tr>
              ) : (
                filteredReflections.map((reflection) => (
                  <tr key={reflection.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(reflection.created_at).toLocaleString()}
                      <br />
                      <span className="text-xs text-gray-500">{reflection.time_of_day}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        reflection.signed_in ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {reflection.signed_in ? '👤 User' : '👻 Guest'}
                      </span>
                      <br />
                      <span className="text-xs text-gray-500 font-mono">
                        {reflection.owner_id.substring(0, 20)}...
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium">{reflection.pig_name || 'Unnamed'}</div>
                      <div className="text-xs text-gray-500">{reflection.pig_id}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                      <p className="truncate">{reflection.text}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {reflection.text.split(/\s+/).length} words • {reflection.input_mode} • {reflection.language}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {reflection.valence !== null && (
                        <div className="text-xs">
                          <span className="font-medium">V:</span> {reflection.valence.toFixed(2)}
                        </div>
                      )}
                      {reflection.arousal !== null && (
                        <div className="text-xs">
                          <span className="font-medium">A:</span> {reflection.arousal.toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {reflection.device_info && (
                        <>
                          <div className="text-xs">{reflection.device_info.type}</div>
                          <div className="text-xs">{reflection.device_info.platform}</div>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Setup Instructions */}
        {reflections.length === 0 && (
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-yellow-900 mb-4">⚙️ Setup Required</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm text-yellow-900">
              <li>Open Supabase dashboard and create a new project</li>
              <li>Run the SQL from <code className="bg-yellow-100 px-1 py-0.5 rounded">supabase-schema.sql</code> in the SQL Editor</li>
              <li>Add environment variables to <code className="bg-yellow-100 px-1 py-0.5 rounded">.env.local</code>:
                <pre className="bg-yellow-100 p-2 rounded mt-2 text-xs overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key`}
                </pre>
              </li>
              <li>Restart your dev server</li>
              <li>Visit <code className="bg-yellow-100 px-1 py-0.5 rounded">/p/testpig</code> and submit a reflection</li>
              <li>Refresh this page to see the data!</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
