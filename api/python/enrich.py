"""
Vercel Serverless Function for Reflection Enrichment
Endpoint: /api/python/enrich
"""
from http.server import BaseHTTPRequestHandler
import json
import os
import sys

# Add behavioral-backend to path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../behavioral-backend/src'))
sys.path.insert(0, backend_path)

try:
    from reflection_agent_service import ReflectionAnalysisAgent
    from upstash_store import UpstashStore
except ImportError:
    # Fallback to original import names
    from agent_service import ReflectionAnalysisAgent
    from persistence import UpstashStore


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Parse request body
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length)
            body = json.loads(body_bytes.decode('utf-8'))
            
            rid = body.get('rid')
            if not rid:
                self.send_error(400, 'Missing rid parameter')
                return
            
            # Initialize backend
            store = UpstashStore()
            agent = ReflectionAnalysisAgent(store)
            
            # Fetch reflection
            reflection = store.get_reflection_by_rid(rid)
            if not reflection:
                self.send_error(404, f'Reflection {rid} not found')
                return
            
            # Process reflection
            result = agent.process_reflection(reflection)
            
            if 'error' in result:
                self.send_error(500, result['error'])
                return
            
            # Send success response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            response = {
                'ok': True,
                'rid': rid,
                'analysis_version': result.get('analysis', {}).get('version'),
                'latency_ms': result.get('analysis', {}).get('provenance', {}).get('latency_ms'),
            }
            
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))
    
    def do_OPTIONS(self):
        # Handle CORS preflight
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
