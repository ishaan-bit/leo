"""
Temporal State Manager for Behavioral Backend
Implements recursive temporal layer with EMA smoothing, volatility tracking, and regime classification.
"""

import math
import time
from typing import Dict, Any, Optional, List
from datetime import datetime

class TemporalStateManager:
    """
    Manages temporal state evolution for behavioral analysis.
    Tracks short-term smoothing, long-term baselines, volatility, drift, and risk momentum.
    """

    # Default initialization values
    DEFAULT_STATE = {
        "S": {"v": 0.0, "a": 0.3},  # Short-term smoothed state (calm start)
        "B": {"v": 0.0, "a": 0.3},  # Long-term baseline
        "sigma": {"v": 0.05, "a": 0.05},  # Volatility (EW variance)
        "R": 0.1,  # Risk momentum (ERI)
        "C": 0.5,  # Confidence momentum
        "z": {"v": 0.0, "a": 0.0},  # Z-scores
        "regime": "normal",
        "last_ts": None,
        "n": 0  # Entry count
    }

    # Time constants (in hours)
    TAU_SHORT = 12.0  # Short-term EMA (12 hours)
    TAU_LONG = 72.0   # Long-term baseline (3 days)
    TAU_RISK = 48.0   # Risk momentum (2 days)
    TAU_SEASON = 168.0  # Seasonality (1 week)

    def __init__(self, persistence_layer=None):
        """
        Initialize temporal state manager.

        Args:
            persistence_layer: Optional persistence interface (e.g., Upstash Redis)
        """
        self.persistence = persistence_layer

    def clamp01(self, x: float) -> float:
        """Clamp value to [0, 1] range."""
        return max(0.0, min(1.0, float(x)))

    def get_user_state(self, user_id: str) -> Dict[str, Any]:
        """
        Retrieve user's temporal state from persistence layer.
        Falls back to defaults if no state exists.

        Args:
            user_id: User identifier

        Returns:
            Temporal state dictionary
        """
        if self.persistence:
            state = self.persistence.get_temporal_state(user_id)
            if state:
                return state

        # Return default state
        return self.DEFAULT_STATE.copy()

    def save_user_state(self, user_id: str, state: Dict[str, Any]) -> None:
        """
        Save user's temporal state to persistence layer.

        Args:
            user_id: User identifier
            state: Temporal state to save
        """
        if self.persistence:
            self.persistence.save_temporal_state(user_id, state)

    def update_temporal_state(self, prev_state: Dict[str, Any], observation: Dict[str, Any],
                            now_ts: Optional[float] = None) -> Dict[str, Any]:
        """
        Update temporal state with new observation using time-aware EMA decay.

        Args:
            prev_state: Previous temporal state
            observation: New observation (per-entry JSON)
            now_ts: Current timestamp (defaults to now)

        Returns:
            Updated temporal state
        """
        if now_ts is None:
            now_ts = time.time()

        # Extract observation values
        invoked = observation.get("invoked", {})
        v_t = float(invoked.get("valence", 0.0))
        a_t = float(invoked.get("arousal", 0.3))
        c_t = float(invoked.get("confidence", 0.5))

        # Extract state values for gap calculation
        state_v = float(observation.get("state", {}).get("v", 0.0))
        state_a = float(observation.get("state", {}).get("a", 0.3))

        # Calculate invoked-state tension (gap)
        gap_t = abs(v_t - state_v) + abs(a_t - state_a)

        # Risk indicator (1 if any SI/critical flags present)
        risk_flags = observation.get("risk_flags", [])
        risk_ind_t = 1.0 if any(flag in ["hopelessness", "self_harm"] for flag in risk_flags) else 0.0

        # Time-aware decay calculation
        last_ts = prev_state.get("last_ts")
        if last_ts:
            dt_h = max(1.0, (now_ts - last_ts) / 3600.0)  # Hours since last entry
        else:
            dt_h = 1.0  # First entry

        # Effective decay rates (time-aware)
        α_eff = 1 - math.exp(-dt_h / self.TAU_SHORT)  # Short-term
        γ_eff = 1 - math.exp(-dt_h / self.TAU_LONG)   # Long-term
        ρ_eff = 1 - math.exp(-dt_h / self.TAU_RISK)   # Risk

        # 1) Short-term smoothing (EMA)
        v_hat = (1 - α_eff) * prev_state["S"]["v"] + α_eff * v_t
        a_hat = (1 - α_eff) * prev_state["S"]["a"] + α_eff * a_t

        # 2) Long-term baseline (confidence-weighted)
        w_t = 0.5 + 0.5 * c_t  # Map confidence [0,1] to weight [0.5,1]
        v_blend = w_t * v_t + (1 - w_t) * v_hat
        a_blend = w_t * a_t + (1 - w_t) * a_hat

        mu_v = (1 - γ_eff) * prev_state["B"]["v"] + γ_eff * v_blend
        mu_a = (1 - γ_eff) * prev_state["B"]["a"] + γ_eff * a_blend

        # 3) Volatility (EW variance)
        eps_v = v_t - mu_v
        eps_a = a_t - mu_a

        sig_v2 = (1 - γ_eff) * (prev_state["sigma"]["v"] ** 2) + γ_eff * (eps_v ** 2)
        sig_a2 = (1 - γ_eff) * (prev_state["sigma"]["a"] ** 2) + γ_eff * (eps_a ** 2)

        sig_v = max(1e-3, math.sqrt(sig_v2))
        sig_a = max(1e-3, math.sqrt(sig_a2))

        # 4) Drift & z-scores
        delta_v = v_hat - prev_state["B"]["v"]
        delta_a = a_hat - prev_state["B"]["a"]

        z_v = delta_v / sig_v
        z_a = delta_a / sig_a

        # 5) Risk momentum (ERI)
        eri_driver = self.clamp01(
            0.45 * max(0.0, a_t - prev_state["B"]["a"]) +  # Arousal spike above baseline
            0.25 * min(1.0, gap_t) +                       # Internal tension
            0.30 * risk_ind_t                              # Explicit risk flags
        )
        R_hat = (1 - ρ_eff) * prev_state["R"] + ρ_eff * eri_driver

        # 6) Confidence momentum
        C_hat = (1 - γ_eff) * prev_state["C"] + γ_eff * c_t

        # 7) Regime classification
        regime = self._classify_regime(R_hat, z_v, z_a, risk_ind_t)

        # Update entry count
        n = prev_state.get("n", 0) + 1

        # Construct updated state
        updated_state = {
            "S": {"v": round(v_hat, 4), "a": round(a_hat, 4)},
            "B": {"v": round(mu_v, 4), "a": round(mu_a, 4)},
            "sigma": {"v": round(sig_v, 4), "a": round(sig_a, 4)},
            "z": {"v": round(z_v, 4), "a": round(z_a, 4)},
            "R": round(R_hat, 4),
            "C": round(C_hat, 4),
            "regime": regime,
            "last_ts": now_ts,
            "n": n
        }

        return updated_state

    def _classify_regime(self, R: float, z_v: float, z_a: float, risk_ind: float) -> str:
        """
        Classify current regime based on risk momentum and z-scores.

        Args:
            R: Risk momentum [0,1]
            z_v: Valence z-score
            z_a: Arousal z-score
            risk_ind: Risk indicator (0 or 1)

        Returns:
            Regime label: "normal", "elevated", or "alert"
        """
        # Alert conditions (highest priority)
        if R >= 0.7 or abs(z_v) >= 2.0 or abs(z_a) >= 2.0 or risk_ind == 1.0:
            return "alert"

        # Elevated conditions
        if R >= 0.35 or max(abs(z_v), abs(z_a)) >= 1.0:
            return "elevated"

        # Normal (default)
        return "normal"

    def update_seasonality(self, user_id: str, observation: Dict[str, Any],
                          now_ts: Optional[float] = None) -> None:
        """
        Update seasonality baselines (optional feature).

        Args:
            user_id: User identifier
            observation: New observation
            now_ts: Current timestamp
        """
        if not self.persistence:
            return

        if now_ts is None:
            now_ts = time.time()

        dt = datetime.fromtimestamp(now_ts)
        dow = dt.weekday()  # 0=Monday, 6=Sunday
        hour = dt.hour

        v_t = observation.get("invoked", {}).get("valence", 0.0)
        a_t = observation.get("invoked", {}).get("arousal", 0.3)

        # Small decay rate for seasonality (weekly)
        γ_season = 1 - math.exp(-1.0 / self.TAU_SEASON)

        # Update day-of-week seasonality
        dow_key = f"dow_{dow}"
        current_dow = self.persistence.get_seasonality(user_id, "dow", dow)
        if current_dow:
            v_dow = (1 - γ_season) * current_dow["v"] + γ_season * v_t
            a_dow = (1 - γ_season) * current_dow["a"] + γ_season * a_t
        else:
            v_dow, a_dow = v_t, a_t

        self.persistence.save_seasonality(user_id, "dow", dow, {
            "v": round(v_dow, 4),
            "a": round(a_dow, 4)
        })

        # Update hour-of-day seasonality
        hour_key = f"hour_{hour}"
        current_hour = self.persistence.get_seasonality(user_id, "hour", hour)
        if current_hour:
            v_hour = (1 - γ_season) * current_hour["v"] + γ_season * v_t
            a_hour = (1 - γ_season) * current_hour["a"] + γ_season * a_t
        else:
            v_hour, a_hour = v_t, a_t

        self.persistence.save_seasonality(user_id, "hour", hour, {
            "v": round(v_hour, 4),
            "a": round(a_hour, 4)
        })

    def update_keyword_memory(self, user_id: str, keywords: List[str]) -> None:
        """
        Update keyword frequency memory using sorted sets.

        Args:
            user_id: User identifier
            keywords: List of keywords to increment
        """
        if not self.persistence:
            return

        for keyword in keywords:
            if keyword.strip():
                self.persistence.increment_keyword(user_id, keyword)

    def log_spike(self, user_id: str, z_v: float, z_a: float, R: float,
                  now_ts: Optional[float] = None) -> None:
        """
        Log significant spikes for monitoring (optional).

        Args:
            user_id: User identifier
            z_v: Valence z-score
            z_a: Arousal z-score
            R: Risk momentum
            now_ts: Timestamp
        """
        if not self.persistence:
            return

        if now_ts is None:
            now_ts = time.time()

        # Only log significant spikes
        if max(abs(z_v), abs(z_a)) >= 1.5 or R >= 0.5:
            spike_data = {
                "zv": round(z_v, 4),
                "za": round(z_a, 4),
                "R": round(R, 4)
            }
            self.persistence.log_spike(user_id, now_ts, spike_data)

    def process_observation(self, user_id: str, observation: Dict[str, Any],
                          now_ts: Optional[float] = None) -> Dict[str, Any]:
        """
        Process a new observation and update all temporal state.
        This is the main entry point for temporal processing.

        Args:
            user_id: User identifier
            observation: New observation (per-entry JSON)
            now_ts: Current timestamp

        Returns:
            Augmented observation with temporal_after
        """
        if now_ts is None:
            now_ts = time.time()

        # Get previous state
        prev_state = self.get_user_state(user_id)

        # Update temporal state
        updated_state = self.update_temporal_state(prev_state, observation, now_ts)

        # Update seasonality (optional)
        self.update_seasonality(user_id, observation, now_ts)

        # Update keyword memory
        keywords = observation.get("event_keywords", [])
        self.update_keyword_memory(user_id, keywords)

        # Log spikes if significant
        z_v = updated_state["z"]["v"]
        z_a = updated_state["z"]["a"]
        R = updated_state["R"]
        self.log_spike(user_id, z_v, z_a, R, now_ts)

        # Save updated state
        self.save_user_state(user_id, updated_state)

        # Augment observation with temporal_after
        augmented = observation.copy()
        augmented["temporal_after"] = updated_state

        return augmented