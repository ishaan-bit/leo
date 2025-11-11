"""
Fetch dialogue tuples from Guide to Urban Loneliness.xlsx on HuggingFace Spaces.
Returns 3 randomly selected dialogue tuples from matching domain/secondary row.
"""

import logging
import random
import requests
from typing import Dict, List, Optional, Tuple
from io import BytesIO
from functools import lru_cache
import time

logger = logging.getLogger(__name__)

try:
    import openpyxl
    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False
    logger.warning("⚠️ openpyxl not installed - Excel dialogue fetching disabled")

# HuggingFace Space URL for Excel file
EXCEL_URL = "https://huggingface.co/spaces/purist-vagabond/micro-content-api/resolve/main/data/Guide%20to%20Urban%20Loneliness.xlsx"

# Domain name mapping (enrichment_v5 → Excel sheet names)
DOMAIN_MAPPING = {
    'self': 'Self',
    'work': 'Work',
    'relationship': 'Relationship',
    'relationships': 'Relationship',
    'health': 'Health',
    'family': 'Family',
    'social': 'Social',
    'study': 'Study',
    'creative': 'Creative',
    'financial': 'Financial',
    'money': 'Financial',
}

# Cache for Excel workbook (refresh every 30 minutes)
_WORKBOOK_CACHE: Optional[openpyxl.Workbook] = None
_CACHE_TIMESTAMP: float = 0
CACHE_TTL = 1800  # 30 minutes


def _fetch_excel_workbook() -> Optional[openpyxl.Workbook]:
    """
    Download and cache the Excel workbook from HuggingFace.
    
    Returns:
        openpyxl.Workbook or None if fetch fails
    """
    global _WORKBOOK_CACHE, _CACHE_TIMESTAMP
    
    if not OPENPYXL_AVAILABLE:
        return None
    
    current_time = time.time()
    
    # Return cached workbook if still valid
    if _WORKBOOK_CACHE and (current_time - _CACHE_TIMESTAMP) < CACHE_TTL:
        logger.debug("Using cached Excel workbook")
        return _WORKBOOK_CACHE
    
    try:
        logger.info(f"📥 Downloading Excel file from {EXCEL_URL}")
        response = requests.get(EXCEL_URL, timeout=15)
        response.raise_for_status()
        
        # Load workbook from bytes
        excel_bytes = BytesIO(response.content)
        workbook = openpyxl.load_workbook(excel_bytes, read_only=True, data_only=True)
        
        # Update cache
        _WORKBOOK_CACHE = workbook
        _CACHE_TIMESTAMP = current_time
        
        logger.info(f"✅ Excel workbook loaded ({len(workbook.sheetnames)} sheets)")
        return workbook
    
    except Exception as e:
        logger.error(f"❌ Failed to fetch Excel file: {e}")
        return None


def _extract_dialogue_tuples_from_row(row: List) -> List[Tuple[str, str, str]]:
    """
    Extract all dialogue tuples from a row.
    
    Expected row format:
    [Domain, Secondary, Dialogue En 1, Dialogue En 2, ..., Dialogue En N, Poem En 1, Poem En 2]
    
    Each Dialogue En cell contains: ["Inner Voice of Reason", "Regulate", "Amuse"]
    
    Args:
        row: Row from Excel sheet
        
    Returns:
        List of tuples (inner_voice, regulate, amuse)
    """
    tuples = []
    
    # Skip first 2 columns (Domain, Secondary)
    # Iterate through remaining columns looking for dialogue tuples
    for cell_idx, cell_value in enumerate(row[2:], start=2):
        if cell_value is None or str(cell_value).strip() == "":
            continue
        
        # Stop at "Poem En" columns
        if "Poem" in str(cell_value):
            break
        
        try:
            # Parse the tuple string
            # Expected format: "['Inner Voice', 'Regulate', 'Amuse']"
            if isinstance(cell_value, str) and cell_value.startswith('['):
                # Use eval safely (only for list literals)
                parsed = eval(cell_value)
                if isinstance(parsed, list) and len(parsed) == 3:
                    tuples.append(tuple(parsed))
            elif isinstance(cell_value, (list, tuple)) and len(cell_value) == 3:
                tuples.append(tuple(cell_value))
        except Exception as e:
            logger.warning(f"Failed to parse dialogue tuple at column {cell_idx}: {e}")
            continue
    
    return tuples


def fetch_dialogue_tuples(domain: str, secondary: str) -> Dict:
    """
    Fetch 3 random dialogue tuples from Excel for given domain/secondary.
    
    Args:
        domain: Domain primary (work, self, relationship, etc.)
        secondary: Wheel secondary emotion (Frustrated, Anxious, etc.)
        
    Returns:
        Dict with structure:
        {
            "found": true,
            "domain": "Work",
            "secondary": "Frustrated",
            "tuples": [
                ["Inner Voice 1", "Regulate 1", "Amuse 1"],
                ["Inner Voice 2", "Regulate 2", "Amuse 2"],
                ["Inner Voice 3", "Regulate 3", "Amuse 3"]
            ],
            "source": "excel"
        }
        
        If not found or error:
        {
            "found": false,
            "error": "Description"
        }
    """
    if not OPENPYXL_AVAILABLE:
        return {
            "found": False,
            "error": "openpyxl not installed - cannot read Excel files"
        }
    
    # Normalize inputs
    domain = domain.lower().strip()
    secondary = secondary.strip()  # Keep original casing
    
    # Map domain to sheet name
    sheet_name = DOMAIN_MAPPING.get(domain, 'Self')
    
    # Fetch workbook
    workbook = _fetch_excel_workbook()
    if not workbook:
        return {
            "found": False,
            "error": "Failed to download Excel file from HuggingFace"
        }
    
    # Find sheet
    if sheet_name not in workbook.sheetnames:
        logger.warning(f"Sheet '{sheet_name}' not found in workbook")
        return {
            "found": False,
            "error": f"Sheet '{sheet_name}' not found in Excel file"
        }
    
    sheet = workbook[sheet_name]
    
    # Find row with matching Secondary value
    # Assume: Column A = Domain, Column B = Secondary
    found_row = None
    for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
        if len(row) < 2:
            continue
        
        row_secondary = str(row[1]).strip() if row[1] else ""
        
        # Case-insensitive match
        if row_secondary.lower() == secondary.lower():
            found_row = row
            logger.info(f"✅ Found row for {sheet_name}/{secondary} at row {row_idx}")
            break
    
    if not found_row:
        logger.warning(f"❌ No row found for {sheet_name}/{secondary}")
        return {
            "found": False,
            "error": f"No data found for {sheet_name}/{secondary}"
        }
    
    # Extract all dialogue tuples from the row
    all_tuples = _extract_dialogue_tuples_from_row(list(found_row))
    
    if not all_tuples:
        logger.warning(f"No dialogue tuples found in row for {sheet_name}/{secondary}")
        return {
            "found": False,
            "error": f"No dialogue tuples found for {sheet_name}/{secondary}"
        }
    
    # Randomly select 3 tuples (or all if fewer than 3)
    if len(all_tuples) >= 3:
        selected_tuples = random.sample(all_tuples, 3)
    else:
        selected_tuples = all_tuples
        # Pad with fallback if needed
        while len(selected_tuples) < 3:
            selected_tuples.append(("noted.", "breathe.", "pause."))
    
    logger.info(f"🎲 Selected {len(selected_tuples)} dialogue tuples for {sheet_name}/{secondary}")
    
    return {
        "found": True,
        "domain": sheet_name,
        "secondary": secondary,
        "tuples": [list(t) for t in selected_tuples],  # Convert to list of lists
        "source": "excel",
        "total_available": len(all_tuples)
    }


# Convenience function for testing
def test_fetch(domain: str = "work", secondary: str = "Frustrated"):
    """Test fetch function with sample data."""
    result = fetch_dialogue_tuples(domain, secondary)
    print(f"\n{'='*60}")
    print(f"Domain: {domain}, Secondary: {secondary}")
    print(f"{'='*60}")
    print(f"Found: {result.get('found')}")
    
    if result.get('found'):
        print(f"Tuples returned: {len(result.get('tuples', []))}")
        for idx, t in enumerate(result.get('tuples', []), 1):
            print(f"\nSet {idx}:")
            print(f"  Inner Voice: {t[0]}")
            print(f"  Regulate: {t[1]}")
            print(f"  Amuse: {t[2]}")
    else:
        print(f"Error: {result.get('error')}")
    print(f"{'='*60}\n")
    
    return result


if __name__ == "__main__":
    # Test with sample data
    test_fetch("work", "Frustrated")
    test_fetch("self", "Anxious")
    test_fetch("relationship", "Jealous")
