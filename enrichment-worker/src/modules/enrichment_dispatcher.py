"""
Enrichment Implementation Dispatcher
Routes between legacy Ollama enricher and new OpenVINO enricher based on env config.
Maintains exact same public interface.

STRICT EMOTION ENFORCEMENT:
All emotion outputs MUST conform to 6×6×6 Willcox Wheel (EES-1).
No synonyms, no extrapolation, 216 valid states only.
"""

import os
import logging
import random
from typing import Dict, Optional
from src.modules.emotion_enforcer import get_emotion_enforcer

logger = logging.getLogger(__name__)


class EnrichmentDispatcher:
    """
    Routes enrichment requests to appropriate implementation.
    Supports feature flags and canary rollout.
    """
    
    def __init__(self):
        """Initialize dispatcher with config from environment."""
        self.impl_mode = os.getenv('ENRICH_IMPL', 'legacy').lower()
        self.canary_percent = int(os.getenv('ENRICH_CANARY_PERCENT', '0'))
        self.auto_rollback = os.getenv('AUTO_ROLLBACK', 'true').lower() == 'true'
        
        self.legacy_enricher = None
        self.ov_enricher = None
        self.ov_failed = False
        
        # STRICT EMOTION ENFORCEMENT
        self.emotion_enforcer = get_emotion_enforcer()
        
        logger.info(f"[DISPATCH] Mode: {self.impl_mode}")
        logger.info(f"[DISPATCH] Canary: {self.canary_percent}%")
        logger.info(f"[DISPATCH] Auto-rollback: {self.auto_rollback}")
        logger.info(f"[DISPATCH] Emotion enforcement: EES-1 (6×6×6 Willcox Wheel)")
        
        self._initialize_enrichers()
    
    def _initialize_enrichers(self):
        """Initialize the configured enricher(s)."""
        
        # Always initialize legacy (for fallback)
        try:
            from src.modules.post_enricher import PostEnricher
            self.legacy_enricher = PostEnricher(
                ollama_base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'),
                ollama_model=os.getenv('OLLAMA_MODEL', 'phi3:mini'),  # Faster on CPU
                temperature=float(os.getenv('STAGE2_TEMPERATURE', '0.8')),
                timeout=int(os.getenv('STAGE2_TIMEOUT', '360'))
            )
            logger.info("[DISPATCH] ✓ Legacy enricher initialized")
        except Exception as e:
            logger.error(f"[DISPATCH] Failed to initialize legacy enricher: {e}")
            if self.impl_mode == 'legacy':
                raise
        
        # Initialize OpenVINO if needed
        if self.impl_mode == 'openvino' or self.canary_percent > 0:
            try:
                from src.modules.enrich_ov import OpenVINOEnricher
                self.ov_enricher = OpenVINOEnricher(
                    model_dir=os.getenv('OV_MODEL_DIR', 'models/ov/phi3-mini'),
                    device=os.getenv('OV_DEVICE', 'GPU'),
                    temperature=float(os.getenv('STAGE2_TEMPERATURE', '0.8')),
                    timeout=int(os.getenv('STAGE2_TIMEOUT', '30'))
                )
                
                # Log device info
                device_info = self.ov_enricher.get_device_info()
                logger.info(f"[DISPATCH] ✓ OpenVINO enricher initialized")
                logger.info(f"[DISPATCH]   Device: {device_info['actual_device']} (requested: {device_info['requested_device']})")
                logger.info(f"[DISPATCH]   Model: {device_info['model_dir']}")
                
            except Exception as e:
                logger.error(f"[DISPATCH] Failed to initialize OpenVINO enricher: {e}")
                self.ov_failed = True
                
                if self.impl_mode == 'openvino' and not self.auto_rollback:
                    raise
                
                if self.impl_mode == 'openvino' and self.auto_rollback:
                    logger.warning("[DISPATCH] Auto-rollback enabled, switching to legacy")
                    self.impl_mode = 'legacy'
    
    def enrich(
        self,
        reflection: Dict,
        raw_text: str,
        normalized_text: str,
        circadian_phase: str = 'afternoon',
        primary: Optional[str] = None,
        secondary: Optional[str] = None,
        tertiary: Optional[str] = None
    ) -> Dict:
        """
        Route enrichment request to appropriate implementation.
        
        **PUBLIC CONTRACT (DO NOT CHANGE):**
        Returns dict with exact keys: poems, tips, closing_line, style, tags
        
        **EMOTION ENFORCEMENT:**
        Validates and normalizes primary/secondary/tertiary to EES-1 schema.
        
        This method signature MUST remain stable for backward compatibility.
        """
        
        # === STRICT EMOTION VALIDATION (EES-1) ===
        # Enforce emotions to 6×6×6 Willcox Wheel before enrichment
        enforced_emotions = self.emotion_enforcer.enforce_hybrid_output({
            'primary': primary or '',
            'secondary': secondary or '',
            'tertiary': tertiary or '',
            'confidence_scores': {
                'primary': 1.0,
                'secondary': 0.8,
                'tertiary': 0.6
            }
        })
        
        # Extract validated micro-nuances for enrichment
        validated_primary = enforced_emotions['primary']['micro']
        validated_secondary = enforced_emotions['secondary']['micro']
        validated_tertiary = enforced_emotions['tertiary']['micro']
        
        # Log corrections if any
        if enforced_emotions['correction_count'] > 0:
            logger.warning(
                f"[EMOTION ENFORCEMENT] Corrected {enforced_emotions['correction_count']}/3 emotions to EES-1 schema"
            )
        
        # Determine which implementation to use
        use_ov = self._should_use_openvino()
        
        impl_name = 'openvino' if use_ov else 'legacy'
        logger.info(f"[DISPATCH] Using implementation: impl={impl_name}")
        
        try:
            if use_ov and self.ov_enricher:
                result = self.ov_enricher.enrich(
                    reflection=reflection,
                    raw_text=raw_text,
                    normalized_text=normalized_text,
                    circadian_phase=circadian_phase,
                    primary=validated_primary,
                    secondary=validated_secondary,
                    tertiary=validated_tertiary
                )
                
                # Validate result has required keys
                self._validate_result(result)
                
                # Inject emotion metadata into result
                result['emotion_enforcement'] = self.emotion_enforcer.format_for_output(enforced_emotions)
                
                return result
                
            else:
                # Use legacy enricher (emotion validation still applied)
                result = self.legacy_enricher.enrich(
                    reflection=reflection,
                    raw_text=raw_text,
                    normalized_text=normalized_text,
                    circadian_phase=circadian_phase
                )
                
                # Inject emotion metadata
                result['emotion_enforcement'] = self.emotion_enforcer.format_for_output(enforced_emotions)
                
                return result
                
        except Exception as e:
            logger.error(f"[DISPATCH] Enrichment failed with {impl_name}: {e}")
            
            # Fallback to legacy if OpenVINO fails
            if use_ov and self.legacy_enricher and self.auto_rollback:
                logger.warning("[DISPATCH] Falling back to legacy enricher")
                result = self.legacy_enricher.enrich(
                    reflection=reflection,
                    raw_text=raw_text,
                    normalized_text=normalized_text,
                    circadian_phase=circadian_phase
                )
                result['emotion_enforcement'] = self.emotion_enforcer.format_for_output(enforced_emotions)
                return result
            
            raise
    
    def _should_use_openvino(self) -> bool:
        """Determine if OpenVINO should be used for this request."""
        
        # If OpenVINO failed to initialize, always use legacy
        if self.ov_failed or not self.ov_enricher:
            return False
        
        # If mode is explicitly set
        if self.impl_mode == 'openvino':
            return True
        elif self.impl_mode == 'legacy':
            return False
        
        # Canary mode: random percentage
        if self.canary_percent > 0:
            return random.random() * 100 < self.canary_percent
        
        return False
    
    def _validate_result(self, result: Dict):
        """Validate result has required schema keys."""
        required_keys = ['poems', 'tips', 'closing_line', 'style', 'tags']
        
        for key in required_keys:
            if key not in result:
                raise ValueError(f"Enrichment result missing required key: {key}")
    
    def run_post_enrichment(self, hybrid_result: Dict) -> Dict:
        """
        Run Stage-2 post-enrichment on hybrid scorer output.
        
        **WRAPPER for backward compatibility with worker.py**
        
        This method maintains the existing interface where worker passes
        full hybrid_result dict and expects it back with post_enrichment added.
        
        Args:
            hybrid_result: Full JSON from hybrid_scorer.enrich()
        
        Returns:
            Same dict with added post_enrichment field and status="complete"
        """
        print(f"\n[*] Stage-2: Post-Enrichment Pipeline (via dispatcher)")
        
        # Skip if already post-enriched
        if 'post_enrichment' in hybrid_result:
            print(f"   [!] Already post-enriched, skipping")
            return hybrid_result
        
        # Extract emotion wheel with EES-1 enforcement
        wheel = hybrid_result.get('wheel', {})
        primary = wheel.get('primary', '')
        secondary = wheel.get('secondary', '')
        tertiary = wheel.get('tertiary', '')
        
        # Extract reflection data
        reflection = {
            'invoked': hybrid_result.get('invoked', ''),
            'expressed': hybrid_result.get('expressed', ''),
            'valence': hybrid_result.get('valence', 0.0),
            'arousal': hybrid_result.get('arousal', 0.0),
        }
        
        # Get raw/normalized text (use invoked if no explicit text)
        raw_text = hybrid_result.get('raw_text', hybrid_result.get('invoked', ''))
        normalized_text = hybrid_result.get('normalized_text', raw_text)
        
        # Get circadian phase from meta
        meta = hybrid_result.get('meta', {})
        circadian_phase = meta.get('circadian_phase', 'afternoon')
        
        # Call dispatcher's enrich method (with EES-1 enforcement)
        enrichment_result = self.enrich(
            reflection=reflection,
            raw_text=raw_text,
            normalized_text=normalized_text,
            circadian_phase=circadian_phase,
            primary=primary,
            secondary=secondary,
            tertiary=tertiary
        )
        
        # Extract post_enrichment from result
        # (emotion_enforcement metadata is already injected)
        post_enrichment = {
            'poems': enrichment_result['poems'],
            'tips': enrichment_result['tips'],
            'closing_line': enrichment_result['closing_line'],
            'style': enrichment_result['style'],
            'tags': enrichment_result['tags'],
        }
        
        # Add emotion enforcement metadata if present
        if 'emotion_enforcement' in enrichment_result:
            post_enrichment['emotion_enforcement'] = enrichment_result['emotion_enforcement']
        
        # Merge into hybrid_result
        hybrid_result['post_enrichment'] = post_enrichment
        hybrid_result['status'] = 'complete'
        
        print(f"[OK] Stage-2 complete with EES-1 enforcement")
        
        return hybrid_result
    
    def get_status(self) -> Dict:
        """Get dispatcher status for health checks."""
        emotion_stats = self.emotion_enforcer.get_stats()
        
        return {
            "mode": self.impl_mode,
            "canary_percent": self.canary_percent,
            "auto_rollback": self.auto_rollback,
            "legacy_available": self.legacy_enricher is not None,
            "openvino_available": self.ov_enricher is not None and not self.ov_failed,
            "openvino_device": self.ov_enricher.get_device_info() if self.ov_enricher else None,
            "emotion_enforcement": {
                "schema_version": "EES-1",
                "total_states": 216,
                "total_validations": emotion_stats['total_validations'],
                "total_corrections": emotion_stats['total_corrections'],
                "compliance_percent": emotion_stats['schema_compliance_percent']
            }
        }
