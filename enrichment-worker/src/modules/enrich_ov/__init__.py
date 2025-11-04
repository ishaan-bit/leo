"""
OpenVINO-powered enrichment module.
Provides GPU-accelerated generation with NPU/CPU fallback.
"""

from .openvino_enricher import OpenVINOEnricher

__all__ = ['OpenVINOEnricher']
