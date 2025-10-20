"""
Recursion Module
Detects reflection threads using hybrid semantic+lexical+time methods
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
import re


class RecursionDetector:
    """Detect threads and links between reflections"""
    
    def __init__(
        self, 
        max_links: int = 5,
        similarity_threshold: float = 0.7,
        time_window_days: int = 14
    ):
        self.max_links = max_links
        self.similarity_threshold = similarity_threshold
        self.time_window_days = time_window_days
    
    def detect_links(
        self, 
        current_text: str,
        current_events: List[str],
        current_timestamp: str,
        history: List[Dict]
    ) -> Dict:
        """
        Detect recursive links to past reflections
        
        Args:
            current_text: Current normalized text
            current_events: Current event labels
            current_timestamp: Current timestamp
            history: Past reflections
        
        Returns:
            {method, links: [{rid, score, relation}], thread_summary, thread_state}
        """
        if not history:
            return {
                'method': 'hybrid(semantic+lexical+time)',
                'links': [],
                'thread_summary': '',
                'thread_state': 'new',
            }
        
        current_dt = datetime.fromisoformat(current_timestamp.replace('Z', '+00:00'))
        
        # Filter history to time window
        recent_history = []
        for item in history:
            item_dt = datetime.fromisoformat(item.get('timestamp', '').replace('Z', '+00:00'))
            if (current_dt - item_dt).days <= self.time_window_days:
                recent_history.append(item)
        
        if not recent_history:
            return {
                'method': 'hybrid(semantic+lexical+time)',
                'links': [],
                'thread_summary': '',
                'thread_state': 'isolated',
            }
        
        # Compute links
        links = []
        
        for item in recent_history[-20:]:  # Last 20 items max
            score = self._compute_similarity(
                current_text, 
                current_events,
                item.get('normalized_text', ''),
                item.get('events', [])
            )
            
            if score >= self.similarity_threshold:
                relation = self._infer_relation(score, current_events, item.get('events', []))
                
                links.append({
                    'rid': item.get('rid'),
                    'score': round(score, 2),
                    'relation': relation,
                })
        
        # Sort by score descending
        links.sort(key=lambda x: x['score'], reverse=True)
        links = links[:self.max_links]
        
        # Generate thread summary
        thread_summary = self._generate_summary(current_events, links)
        
        # Determine thread state
        thread_state = self._determine_state(links)
        
        return {
            'method': 'hybrid(semantic+lexical+time)',
            'links': links,
            'thread_summary': thread_summary,
            'thread_state': thread_state,
        }
    
    def _compute_similarity(
        self, 
        text1: str, 
        events1: List[str],
        text2: str, 
        events2: List[str]
    ) -> float:
        """
        Compute hybrid similarity score
        
        Args:
            text1: Current text
            events1: Current events
            text2: Past text
            events2: Past events
        
        Returns:
            Similarity score [0, 1]
        """
        # Lexical overlap (Jaccard similarity)
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 or not words2:
            lexical_score = 0.0
        else:
            intersection = len(words1 & words2)
            union = len(words1 | words2)
            lexical_score = intersection / union if union > 0 else 0.0
        
        # Event overlap
        events1_set = set(events1)
        events2_set = set(events2)
        
        if not events1_set or not events2_set:
            event_score = 0.0
        else:
            event_intersection = len(events1_set & events2_set)
            event_union = len(events1_set | events2_set)
            event_score = event_intersection / event_union if event_union > 0 else 0.0
        
        # Weighted combination
        # Events are more reliable than raw text
        combined_score = 0.4 * lexical_score + 0.6 * event_score
        
        return combined_score
    
    def _infer_relation(self, score: float, events1: List[str], events2: List[str]) -> str:
        """
        Infer relation type based on score and events
        
        Args:
            score: Similarity score
            events1: Current events
            events2: Past events
        
        Returns:
            Relation string (e.g., "similar", "recurring", "escalating")
        """
        overlap = set(events1) & set(events2)
        
        if score >= 0.9:
            return 'identical'
        elif score >= 0.75:
            if overlap:
                return 'recurring'
            else:
                return 'similar'
        else:
            if overlap:
                return 'related'
            else:
                return 'tangential'
    
    def _generate_summary(self, current_events: List[str], links: List[Dict]) -> str:
        """
        Generate thread summary
        
        Args:
            current_events: Current event labels
            links: Detected links
        
        Returns:
            Summary string (≤160 chars)
        """
        if not links:
            if current_events:
                return f"New thread: {', '.join(current_events[:2])}"
            else:
                return "Isolated reflection"
        
        # Extract relations
        relations = [link['relation'] for link in links]
        recurring_count = relations.count('recurring')
        
        if recurring_count >= 2:
            return f"Recurring pattern: {', '.join(current_events[:2])} ({recurring_count}x)"
        elif links[0]['score'] >= 0.8:
            return f"Continuation of {links[0]['relation']} theme"
        else:
            return f"Loosely connected to {len(links)} past reflections"
    
    def _determine_state(self, links: List[Dict]) -> str:
        """
        Determine thread state
        
        Args:
            links: Detected links
        
        Returns:
            State string (e.g., "new", "ongoing", "resolved", "escalating")
        """
        if not links:
            return 'new'
        
        if len(links) >= 3:
            return 'ongoing'
        elif links[0]['score'] >= 0.9:
            return 'recurring'
        else:
            return 'related'
