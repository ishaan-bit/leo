"""
Taxonomy Validator - Ensures all emotion labels conform to 6×6×6 cube

Validates that every emotion record has valid {primary, secondary, tertiary}
paths within the strict taxonomy. NO synonyms, NO drift.
"""

import json
from pathlib import Path
from typing import Dict, List, Tuple, Optional

class TaxonomyValidator:
    def __init__(self, taxonomy_path: Path = Path("enrichment-worker/data/curated/taxonomy_216.json")):
        with open(taxonomy_path, 'r') as f:
            self.taxonomy = json.load(f)
        
        self.cores = set(self.taxonomy['cores'])
        self.nuances = self.taxonomy['nuances']
        self.micros = self.taxonomy['micros']
        
        # Build reverse lookups
        self.nuance_to_core = {}
        for core, nuance_list in self.nuances.items():
            for nuance in nuance_list:
                self.nuance_to_core[nuance] = core
        
        self.micro_to_nuance = {}
        for nuance, micro_list in self.micros.items():
            for micro in micro_list:
                if micro not in self.micro_to_nuance:
                    self.micro_to_nuance[micro] = []
                self.micro_to_nuance[micro].append(nuance)
    
    def validate_path(self, primary: str, secondary: str, tertiary: str) -> Tuple[bool, Optional[str]]:
        """
        Validate a complete emotion path
        
        Returns:
            (is_valid, error_message)
        """
        # Check primary (core)
        if primary not in self.cores:
            return False, f"Invalid primary '{primary}'. Must be one of {self.cores}"
        
        # Check secondary (nuance)
        if primary not in self.nuances:
            return False, f"Primary '{primary}' has no nuances defined"
        
        valid_nuances = self.nuances[primary]
        if secondary not in valid_nuances:
            return False, f"Invalid secondary '{secondary}' for primary '{primary}'. Must be one of {valid_nuances}"
        
        # Check tertiary (micro)
        if secondary not in self.micros:
            return False, f"Secondary '{secondary}' has no micros defined"
        
        valid_micros = self.micros[secondary]
        if tertiary not in valid_micros:
            return False, f"Invalid tertiary '{tertiary}' for secondary '{secondary}'. Must be one of {valid_micros}"
        
        return True, None
    
    def validate_primary_only(self, primary: str) -> Tuple[bool, Optional[str]]:
        """Validate just the primary emotion"""
        if primary not in self.cores:
            return False, f"Invalid primary '{primary}'. Must be one of {self.cores}"
        return True, None
    
    def get_valid_secondaries(self, primary: str) -> List[str]:
        """Get all valid secondary emotions for a primary"""
        return self.nuances.get(primary, [])
    
    def get_valid_tertiaries(self, secondary: str) -> List[str]:
        """Get all valid tertiary emotions for a secondary"""
        return self.micros.get(secondary, [])
    
    def infer_primary(self, secondary: str) -> Optional[str]:
        """Infer primary from secondary"""
        return self.nuance_to_core.get(secondary)
    
    def infer_secondary(self, tertiary: str) -> List[str]:
        """Infer possible secondaries from tertiary"""
        return self.micro_to_nuance.get(tertiary, [])
    
    def validate_dataset(self, data_path: Path, primary_field: str = 'primary', 
                        secondary_field: str = 'secondary', tertiary_field: str = 'tertiary'):
        """
        Validate an entire dataset file
        
        Returns:
            (num_valid, num_invalid, errors)
        """
        errors = []
        valid_count = 0
        invalid_count = 0
        
        with open(data_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                try:
                    item = json.loads(line)
                    primary = item.get(primary_field)
                    secondary = item.get(secondary_field)
                    tertiary = item.get(tertiary_field)
                    
                    if not all([primary, secondary, tertiary]):
                        errors.append(f"Line {line_num}: Missing emotion fields")
                        invalid_count += 1
                        continue
                    
                    is_valid, error = self.validate_path(primary, secondary, tertiary)
                    
                    if is_valid:
                        valid_count += 1
                    else:
                        invalid_count += 1
                        errors.append(f"Line {line_num}: {error}")
                        
                except json.JSONDecodeError:
                    errors.append(f"Line {line_num}: Invalid JSON")
                    invalid_count += 1
        
        return valid_count, invalid_count, errors
    
    def print_taxonomy_stats(self):
        """Print taxonomy statistics"""
        print("=" * 60)
        print("TAXONOMY STATISTICS (6×6×6 Emotion Cube)")
        print("=" * 60)
        print(f"Primary emotions (cores): {len(self.cores)}")
        print(f"Secondary emotions (nuances): {sum(len(v) for v in self.nuances.values())}")
        print(f"Tertiary emotions (micros): {sum(len(v) for v in self.micros.values())}")
        print(f"Total paths: {len(self.cores)} × 6 × 6 = {len(self.cores) * 6 * 6}")
        print()
        
        for core in self.cores:
            nuances = self.nuances[core]
            print(f"{core}: {len(nuances)} nuances")
            for nuance in nuances:
                micros = self.micros.get(nuance, [])
                print(f"  └─ {nuance}: {len(micros)} micros")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Validate emotion taxonomy")
    parser.add_argument('--dataset', type=str, help='Path to dataset JSONL to validate')
    parser.add_argument('--stats', action='store_true', help='Print taxonomy statistics')
    
    args = parser.parse_args()
    
    validator = TaxonomyValidator()
    
    if args.stats:
        validator.print_taxonomy_stats()
    
    if args.dataset:
        print(f"\nValidating dataset: {args.dataset}")
        valid, invalid, errors = validator.validate_dataset(Path(args.dataset))
        
        print(f"\n✓ Valid: {valid}")
        print(f"✗ Invalid: {invalid}")
        
        if errors:
            print(f"\nFirst 10 errors:")
            for error in errors[:10]:
                print(f"  {error}")
            
            if len(errors) > 10:
                print(f"  ... and {len(errors) - 10} more errors")


if __name__ == "__main__":
    main()
