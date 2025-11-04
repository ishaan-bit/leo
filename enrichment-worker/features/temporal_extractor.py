"""
Temporal feature extraction (Tm) for congruence/comparator variables.

Extracts time-series features from user's reflection timeline:
- EMA (exponential moving average) of valence/arousal
- Variance/volatility metrics
- Recency-weighted emotion shifts
- Hour-of-day embeddings
- Timeline density (reflections/day)

Used for:
- Congruence (alignment with recent emotional state)
- Comparator (relative to 7-day baseline)

Output: Temporal context features for sequence models (GRU/Transformer).
"""

import numpy as np
from typing import List, Dict, Optional
from collections import defaultdict
from datetime import datetime, timedelta
import math


class TemporalFeatureExtractor:
    """
    Extract temporal/sequential features from user timeline.
    
    Features:
    - EMA of valence/arousal (α=0.3, 0.7)
    - 7-day rolling variance
    - Recency-weighted emotion shifts
    - Hour-of-day sine/cosine encoding
    - Timeline density (reflections/day)
    - Longest gap between reflections
    """
    
    def __init__(
        self,
        ema_alpha: float = 0.3,
        lookback_days: int = 7,
        max_sequence_length: int = 10
    ):
        """
        Initialize temporal extractor.
        
        Args:
            ema_alpha: Smoothing factor for EMA (0-1, lower = smoother)
            lookback_days: Days to look back for context
            max_sequence_length: Max reflections in sequence
        """
        self.ema_alpha = ema_alpha
        self.lookback_days = lookback_days
        self.max_sequence_length = max_sequence_length
    
    def extract(
        self,
        current_item: Dict,
        user_timeline: List[Dict],
        current_ts: Optional[datetime] = None
    ) -> Dict:
        """
        Extract temporal features for a single reflection.
        
        Args:
            current_item: Current reflection item
            user_timeline: List of past reflections (sorted by timestamp)
            current_ts: Current timestamp (default: now)
        
        Returns:
            Dict of temporal features
        """
        if current_ts is None:
            current_ts = datetime.now()
        
        # Filter timeline to lookback window
        cutoff_ts = current_ts - timedelta(days=self.lookback_days)
        recent_timeline = [
            item for item in user_timeline
            if self._parse_ts(item.get("ts")) >= cutoff_ts
        ]
        
        # Sort by timestamp
        recent_timeline = sorted(
            recent_timeline,
            key=lambda x: self._parse_ts(x.get("ts"))
        )
        
        features = {
            # Basic timeline stats
            "timeline_count": len(recent_timeline),
            "timeline_days": self.lookback_days,
            "timeline_density": len(recent_timeline) / self.lookback_days,
            
            # EMA features
            **self._extract_ema_features(recent_timeline),
            
            # Variance/volatility
            **self._extract_variance_features(recent_timeline),
            
            # Recency-weighted shifts
            **self._extract_shift_features(recent_timeline),
            
            # Time-of-day
            **self._extract_time_of_day(current_ts),
            
            # Gap features
            **self._extract_gap_features(recent_timeline, current_ts),
        }
        
        return features
    
    def extract_batch(
        self,
        items: List[Dict],
        user_timelines: Dict[str, List[Dict]]
    ) -> List[Dict]:
        """
        Extract temporal features for batch of items.
        
        Args:
            items: List of current reflection items
            user_timelines: Dict mapping user_id to timeline of past reflections
        
        Returns:
            List of items with added 'tm_features' field
        """
        for item in items:
            user_id = item.get("owner_id")
            current_ts = self._parse_ts(item.get("ts"))
            
            # Get user's timeline (exclude current item)
            timeline = user_timelines.get(user_id, [])
            timeline = [
                t for t in timeline
                if self._parse_ts(t.get("ts")) < current_ts
            ]
            
            # Extract features
            item["tm_features"] = self.extract(item, timeline, current_ts)
        
        return items
    
    def _parse_ts(self, ts: Optional[str]) -> datetime:
        """Parse timestamp string to datetime."""
        if ts is None:
            return datetime.now()
        
        # Handle multiple formats
        try:
            # ISO format: "2024-01-15T10:30:00Z"
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except:
            try:
                # Unix timestamp
                return datetime.fromtimestamp(float(ts))
            except:
                return datetime.now()
    
    def _extract_ema_features(self, timeline: List[Dict]) -> Dict:
        """
        Compute EMA (exponential moving average) of valence/arousal.
        
        Uses α=0.3 (smooth) for baseline, α=0.7 (reactive) for recent shifts.
        """
        if not timeline:
            return {
                "ema_valence_smooth": 0.5,
                "ema_arousal_smooth": 0.5,
                "ema_valence_reactive": 0.5,
                "ema_arousal_reactive": 0.5,
            }
        
        # Extract valence/arousal from timeline
        valences = [item.get("valence", 0.5) for item in timeline]
        arousals = [item.get("arousal", 0.5) for item in timeline]
        
        # Compute EMA with two alphas
        ema_v_smooth = self._compute_ema(valences, alpha=0.3)
        ema_a_smooth = self._compute_ema(arousals, alpha=0.3)
        ema_v_reactive = self._compute_ema(valences, alpha=0.7)
        ema_a_reactive = self._compute_ema(arousals, alpha=0.7)
        
        return {
            "ema_valence_smooth": ema_v_smooth,
            "ema_arousal_smooth": ema_a_smooth,
            "ema_valence_reactive": ema_v_reactive,
            "ema_arousal_reactive": ema_a_reactive,
        }
    
    def _compute_ema(self, values: List[float], alpha: float) -> float:
        """
        Compute exponential moving average.
        
        EMA_t = α * value_t + (1 - α) * EMA_{t-1}
        """
        if not values:
            return 0.5
        
        ema = values[0]
        for val in values[1:]:
            ema = alpha * val + (1 - alpha) * ema
        
        return ema
    
    def _extract_variance_features(self, timeline: List[Dict]) -> Dict:
        """
        Compute variance/volatility over lookback window.
        
        High variance = emotional instability.
        """
        if len(timeline) < 2:
            return {
                "valence_variance": 0.0,
                "arousal_variance": 0.0,
                "emotional_volatility": 0.0,
            }
        
        valences = [item.get("valence", 0.5) for item in timeline]
        arousals = [item.get("arousal", 0.5) for item in timeline]
        
        valence_var = float(np.var(valences))
        arousal_var = float(np.var(arousals))
        
        # Volatility = combined variance
        volatility = math.sqrt(valence_var**2 + arousal_var**2)
        
        return {
            "valence_variance": valence_var,
            "arousal_variance": arousal_var,
            "emotional_volatility": volatility,
        }
    
    def _extract_shift_features(self, timeline: List[Dict]) -> Dict:
        """
        Compute recency-weighted emotion shifts.
        
        Recent changes matter more than distant ones.
        """
        if len(timeline) < 2:
            return {
                "recent_valence_shift": 0.0,
                "recent_arousal_shift": 0.0,
            }
        
        # Get last two reflections
        prev = timeline[-2]
        latest = timeline[-1]
        
        valence_shift = latest.get("valence", 0.5) - prev.get("valence", 0.5)
        arousal_shift = latest.get("arousal", 0.5) - prev.get("arousal", 0.5)
        
        return {
            "recent_valence_shift": valence_shift,
            "recent_arousal_shift": arousal_shift,
        }
    
    def _extract_time_of_day(self, ts: datetime) -> Dict:
        """
        Encode hour-of-day as sine/cosine (cyclical).
        
        Sine/cosine encoding preserves circular nature of time.
        """
        hour = ts.hour
        
        # Convert to radians (0-24 hours → 0-2π)
        hour_rad = (hour / 24.0) * 2 * math.pi
        
        return {
            "hour": hour,
            "hour_sin": math.sin(hour_rad),
            "hour_cos": math.cos(hour_rad),
        }
    
    def _extract_gap_features(self, timeline: List[Dict], current_ts: datetime) -> Dict:
        """
        Extract features about gaps between reflections.
        
        Long gaps may indicate avoidance or reduced engagement.
        """
        if not timeline:
            return {
                "days_since_last": self.lookback_days,
                "max_gap_days": self.lookback_days,
                "avg_gap_days": self.lookback_days,
            }
        
        # Days since last reflection
        last_ts = self._parse_ts(timeline[-1].get("ts"))
        days_since_last = (current_ts - last_ts).total_seconds() / 86400
        
        # Gaps between consecutive reflections
        gaps = []
        for i in range(1, len(timeline)):
            prev_ts = self._parse_ts(timeline[i-1].get("ts"))
            curr_ts = self._parse_ts(timeline[i].get("ts"))
            gap_days = (curr_ts - prev_ts).total_seconds() / 86400
            gaps.append(gap_days)
        
        max_gap = max(gaps) if gaps else self.lookback_days
        avg_gap = sum(gaps) / len(gaps) if gaps else self.lookback_days
        
        return {
            "days_since_last": days_since_last,
            "max_gap_days": max_gap,
            "avg_gap_days": avg_gap,
        }
    
    def prepare_sequence(
        self,
        user_timeline: List[Dict],
        current_ts: datetime,
        sequence_length: int = None
    ) -> np.ndarray:
        """
        Prepare sequence of reflections for GRU/Transformer input.
        
        Args:
            user_timeline: List of past reflections
            current_ts: Current timestamp
            sequence_length: Max sequence length (default: self.max_sequence_length)
        
        Returns:
            (seq_len, feature_dim) array with:
            - valence, arousal
            - invoked probs (if available)
            - expressed probs (if available)
            - hour_sin, hour_cos
            - EMA delta from previous
        """
        seq_len = sequence_length or self.max_sequence_length
        
        # Filter to lookback window
        cutoff_ts = current_ts - timedelta(days=self.lookback_days)
        recent_timeline = [
            item for item in user_timeline
            if self._parse_ts(item.get("ts")) >= cutoff_ts
        ]
        
        # Sort and take last N
        recent_timeline = sorted(
            recent_timeline,
            key=lambda x: self._parse_ts(x.get("ts"))
        )[-seq_len:]
        
        # Build sequence
        sequence = []
        for item in recent_timeline:
            ts = self._parse_ts(item.get("ts"))
            hour_rad = (ts.hour / 24.0) * 2 * math.pi
            
            features = [
                item.get("valence", 0.5),
                item.get("arousal", 0.5),
                math.sin(hour_rad),
                math.cos(hour_rad),
                # Add invoked/expressed probs if available
                # item.get("invoked_prob", 0.0),
                # item.get("expressed_prob", 0.0),
            ]
            sequence.append(features)
        
        # Pad if needed
        while len(sequence) < seq_len:
            sequence.insert(0, [0.5, 0.5, 0.0, 1.0])  # Neutral padding
        
        return np.array(sequence, dtype=np.float32)


def main():
    """Demo usage."""
    extractor = TemporalFeatureExtractor(
        ema_alpha=0.3,
        lookback_days=7,
        max_sequence_length=10
    )
    
    # Mock timeline
    base_ts = datetime.now() - timedelta(days=7)
    timeline = []
    for i in range(10):
        ts = base_ts + timedelta(days=i * 0.7, hours=i * 2)
        timeline.append({
            "rid": f"r{i}",
            "ts": ts.isoformat(),
            "valence": 0.3 + i * 0.05,  # Gradually improving
            "arousal": 0.6 - i * 0.03,  # Gradually calming
        })
    
    # Current item
    current_ts = datetime.now()
    current_item = {
        "rid": "current",
        "ts": current_ts.isoformat(),
        "owner_id": "user123"
    }
    
    features = extractor.extract(current_item, timeline, current_ts)
    
    print("="*70)
    print("TEMPORAL FEATURE EXTRACTION — Demo")
    print("="*70)
    
    print(f"\nTimeline: {len(timeline)} reflections over 7 days")
    print(f"Timeline density: {features['timeline_density']:.2f} reflections/day")
    
    print(f"\nEMA (smooth, α=0.3):")
    print(f"  Valence: {features['ema_valence_smooth']:.3f}")
    print(f"  Arousal: {features['ema_arousal_smooth']:.3f}")
    
    print(f"\nEMA (reactive, α=0.7):")
    print(f"  Valence: {features['ema_valence_reactive']:.3f}")
    print(f"  Arousal: {features['ema_arousal_reactive']:.3f}")
    
    print(f"\nVariance:")
    print(f"  Valence: {features['valence_variance']:.3f}")
    print(f"  Arousal: {features['arousal_variance']:.3f}")
    print(f"  Volatility: {features['emotional_volatility']:.3f}")
    
    print(f"\nRecent shifts:")
    print(f"  Valence: {features['recent_valence_shift']:+.3f}")
    print(f"  Arousal: {features['recent_arousal_shift']:+.3f}")
    
    print(f"\nTime-of-day:")
    print(f"  Hour: {features['hour']}")
    print(f"  Sin: {features['hour_sin']:.3f}")
    print(f"  Cos: {features['hour_cos']:.3f}")
    
    print(f"\nGaps:")
    print(f"  Days since last: {features['days_since_last']:.1f}")
    print(f"  Max gap: {features['max_gap_days']:.1f} days")
    print(f"  Avg gap: {features['avg_gap_days']:.1f} days")
    
    # Sequence
    sequence = extractor.prepare_sequence(timeline, current_ts)
    print(f"\nSequence shape: {sequence.shape}")
    print(f"Last 3 timesteps:")
    print(sequence[-3:])


if __name__ == "__main__":
    main()
