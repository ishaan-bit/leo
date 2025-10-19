'use client';

import { useState, useEffect } from 'react';

export default function KVViewerPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/admin/kv-data');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch data');
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading KV data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Vercel KV Data Viewer</h1>
          <button
            onClick={loadAllData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            🔄 Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">❌ {error}</p>
          </div>
        )}

        {data && (
          <>
            {/* Stats Summary */}
            {data.stats && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-sm text-gray-500 mb-1">Total Reflections</p>
                  <p className="text-4xl font-bold text-blue-600">{data.stats.total_reflections}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-sm text-gray-500 mb-1">Total Pigs</p>
                  <p className="text-4xl font-bold text-pink-600">{data.stats.total_pigs}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <p className="text-sm text-gray-500 mb-1">Total Keys</p>
                  <p className="text-4xl font-bold text-purple-600">{data.stats.total_keys}</p>
                </div>
              </div>
            )}

            {/* All Keys */}
            {data.all_keys && data.all_keys.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-semibold mb-3">All Redis Keys ({data.all_keys.length})</h3>
                <div className="bg-gray-50 p-4 rounded max-h-60 overflow-auto">
                  <pre className="text-xs font-mono">{data.all_keys.join('\n')}</pre>
                </div>
              </div>
            )}

            {/* Pigs */}
            {data.pigs && data.pigs.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">All Pigs ({data.pigs.length})</h3>
                <div className="space-y-3">
                  {data.pigs.map((pig: any, index: number) => (
                    <div key={index} className="flex justify-between items-center p-4 bg-pink-50 rounded-lg border border-pink-200">
                      <div>
                        <p className="text-lg font-medium">🐷 {pig.data.name}</p>
                        <p className="text-sm text-gray-600 font-mono mt-1">{pig.key}</p>
                        {pig.data.pig_id && (
                          <p className="text-xs text-gray-500 mt-1">ID: {pig.data.pig_id}</p>
                        )}
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <p className="text-xs">Created</p>
                        <p>{new Date(pig.data.created_at).toLocaleString()}</p>
                        {pig.data.updated_at && (
                          <>
                            <p className="text-xs mt-2">Updated</p>
                            <p>{new Date(pig.data.updated_at).toLocaleString()}</p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reflections */}
            {data.reflections && data.reflections.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">All Reflections ({data.reflections.length})</h3>
                <div className="space-y-4">
                  {data.reflections.map((reflection: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4 bg-gray-50">
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-gray-500">Reflection ID</p>
                          <p className="font-mono text-sm">{reflection.id}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Created</p>
                          <p className="text-sm">{new Date(reflection.created_at).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Pig</p>
                          <p className="text-sm">{reflection.pig_name || 'Unnamed'} ({reflection.pig_id})</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Owner</p>
                          <p className="text-xs font-mono break-all">{reflection.owner_id}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Input Mode</p>
                          <p className="text-sm">{reflection.input_mode}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Signed In</p>
                          <p className="text-sm">{reflection.signed_in ? '✅ Yes' : '❌ Guest'}</p>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">Reflection Text</p>
                        <p className="text-base p-3 bg-white rounded border">{reflection.text}</p>
                      </div>

                      <details className="text-sm">
                        <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                          Full Data (JSON)
                        </summary>
                        <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded text-xs overflow-auto">
                          {JSON.stringify(reflection, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Data Message */}
            {(!data.reflections || data.reflections.length === 0) && (!data.pigs || data.pigs.length === 0) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
                <p className="text-yellow-800 mb-4">No data found in KV database</p>
                <p className="text-sm text-yellow-600">Try creating a reflection first:</p>
                <a 
                  href="/p/test_pig_viewer" 
                  className="inline-block mt-4 px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  Create Test Reflection
                </a>
              </div>
            )}
          </>
        )}

        {/* Quick Links */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="font-semibold mb-3">External Links:</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <a 
                href="https://vercel.com/ishaan-bit/leo/storage" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                📊 Vercel Storage Dashboard
              </a>
            </li>
            <li>
              <a 
                href="https://console.upstash.com/" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                🔧 Upstash Console
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
