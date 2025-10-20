"""
Baseline Tuning Script
Grid/random search to optimize baseline enricher hyperparameters
"""

import json
import random
import time
from pathlib import Path
from typing import Dict, List, Tuple
import sys

sys.path.append(str(Path(__file__).parent.parent / 'enrichment-worker' / 'src'))
from modules.baseline_enricher import BaselineEnricher


class BaselineTuner:
    """Tunes baseline enricher hyperparameters"""
    
    def __init__(self, data_path: str):
        """
        Initialize tuner
        
        Args:
            data_path: Path to baseline_50.jsonl
        """
        self.data_path = Path(data_path)
        self.dataset = self.load_dataset()
        self.best_score = 0.0
        self.best_config = None
        self.best_report = None
        
    def load_dataset(self) -> List[Dict]:
        """Load baseline_50.jsonl dataset"""
        dataset = []
        with open(self.data_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    dataset.append(json.loads(line))
        print(f"✓ Loaded {len(dataset)} examples from {self.data_path}")
        return dataset
    
    def evaluate(self, config: Dict) -> Tuple[float, Dict]:
        """
        Evaluate config on dataset
        
        Args:
            config: Hyperparameter dict
        
        Returns:
            (pass_rate, detailed_report)
        """
        enricher = BaselineEnricher(config)
        
        scores = []
        passes = 0
        detailed_results = []
        
        for example in self.dataset:
            normalized_text = example['normalized_text']
            expect = example['expect']
            
            # Run enrichment
            result = enricher.enrich(normalized_text)
            
            # Score
            score_dict = self.score_result(result, expect)
            total_score = score_dict['total']
            
            scores.append(total_score)
            if total_score >= 0.60:
                passes += 1
            
            detailed_results.append({
                'id': example['id'],
                'text': normalized_text,
                'expected': expect,
                'got': result,
                'score': score_dict
            })
        
        avg_score = sum(scores) / len(scores)
        pass_rate = passes / len(scores)
        
        report = {
            'avg_score': round(avg_score, 4),
            'pass_rate': round(pass_rate, 4),
            'passes': passes,
            'total': len(scores),
            'score_distribution': {
                '0.0-0.2': sum(1 for s in scores if s < 0.2),
                '0.2-0.4': sum(1 for s in scores if 0.2 <= s < 0.4),
                '0.4-0.6': sum(1 for s in scores if 0.4 <= s < 0.6),
                '0.6-0.8': sum(1 for s in scores if 0.6 <= s < 0.8),
                '0.8-1.0': sum(1 for s in scores if s >= 0.8),
            },
            'detailed_results': detailed_results[:5]  # First 5 for debugging
        }
        
        return pass_rate, report
    
    def score_result(self, result: Dict, expect: Dict) -> Dict:
        """
        Score a single result
        
        Args:
            result: Enriched output
            expect: Expected values
        
        Returns:
            Score dict with breakdown
        """
        # Events (F1 score, 40% weight)
        expected_events = set(expect.get('events', []))
        got_events = set([e['label'] for e in result.get('events', [])])
        
        if expected_events or got_events:
            intersection = len(expected_events & got_events)
            precision = intersection / len(got_events) if got_events else 0
            recall = intersection / len(expected_events) if expected_events else 0
            f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        else:
            f1 = 1.0
        
        events_score = f1 * 0.40
        
        # Wheel primary (exact or synonym match, 20% weight)
        expected_wheel = expect.get('wheel_primary', '').lower()
        got_wheel = result.get('wheel', {}).get('primary', '').lower()
        
        wheel_synonyms = {
            'joy': ['happiness', 'contentment'],
            'sadness': ['melancholy', 'sorrow'],
            'fear': ['anxiety', 'worry'],
            'anger': ['frustration', 'irritation'],
        }
        
        wheel_match = 0.0
        if got_wheel == expected_wheel:
            wheel_match = 1.0
        else:
            for primary, synonyms in wheel_synonyms.items():
                if expected_wheel in [primary] + synonyms and got_wheel in [primary] + synonyms:
                    wheel_match = 0.8
                    break
        
        wheel_score = wheel_match * 0.20
        
        # Valence range (20% weight)
        valence_range = expect.get('valence_range', [0.0, 1.0])
        got_valence = result.get('valence', 0.5)
        valence_match = 1.0 if valence_range[0] <= got_valence <= valence_range[1] else 0.0
        valence_score = valence_match * 0.20
        
        # Arousal range (20% weight)
        arousal_range = expect.get('arousal_range', [0.0, 1.0])
        got_arousal = result.get('arousal', 0.5)
        arousal_match = 1.0 if arousal_range[0] <= got_arousal <= arousal_range[1] else 0.0
        arousal_score = arousal_match * 0.20
        
        total = events_score + wheel_score + valence_score + arousal_score
        
        return {
            'events_score': round(events_score, 3),
            'wheel_score': round(wheel_score, 3),
            'valence_score': round(valence_score, 3),
            'arousal_score': round(arousal_score, 3),
            'total': round(total, 3),
            'f1': round(f1, 3),
            'wheel_match': round(wheel_match, 2),
            'valence_match': valence_match,
            'arousal_match': arousal_match
        }
    
    def generate_random_config(self) -> Dict:
        """Generate random hyperparameter config"""
        return {
            'fatigue_weight': random.uniform(0.7, 1.5),
            'irritation_weight': random.uniform(0.8, 1.8),
            'progress_weight': random.uniform(0.6, 1.2),
            'joy_weight': random.uniform(0.8, 1.5),
            'anxiety_weight': random.uniform(0.9, 1.8),
            
            'hedge_penalty': random.uniform(0.05, 0.25),
            'intensifier_boost': random.uniform(0.10, 0.35),
            'negation_flip': random.uniform(0.20, 0.60),
            
            'fatigue_threshold': random.uniform(0.15, 0.35),
            'irritation_threshold': random.uniform(0.20, 0.45),
            'anxiety_threshold': random.uniform(0.25, 0.50),
            'joy_threshold': random.uniform(0.50, 0.75),
            
            'baseline_valence': random.uniform(0.45, 0.55),
            'baseline_arousal': random.uniform(0.45, 0.55),
            
            'min_valence': 0.05,
            'max_valence': 0.95,
            'min_arousal': 0.05,
            'max_arousal': 0.95,
        }
    
    def tune(
        self,
        max_trials: int = 200,
        time_budget_min: float = 15.0,
        target_pass: float = 0.60,
        early_stop: bool = True
    ) -> Tuple[Dict, Dict]:
        """
        Run hyperparameter search
        
        Args:
            max_trials: Max number of trials
            time_budget_min: Max time budget in minutes
            target_pass: Target pass rate for early stopping
            early_stop: Whether to stop early when target reached
        
        Returns:
            (best_config, best_report)
        """
        print(f"\n🔍 Starting hyperparameter search...")
        print(f"   Max trials: {max_trials}")
        print(f"   Time budget: {time_budget_min} min")
        print(f"   Target pass rate: {target_pass*100}%")
        print(f"   Early stop: {early_stop}\n")
        
        start_time = time.time()
        time_budget_sec = time_budget_min * 60
        
        # Start with default config
        default_config = BaselineEnricher.get_default_config()
        print("Trial 0: Default config")
        pass_rate, report = self.evaluate(default_config)
        print(f"  Pass rate: {pass_rate*100:.1f}% | Avg score: {report['avg_score']:.3f}")
        
        self.best_score = pass_rate
        self.best_config = default_config
        self.best_report = report
        
        if early_stop and pass_rate >= target_pass:
            print(f"\n✓ Target pass rate {target_pass*100}% reached on default config!")
            return self.best_config, self.best_report
        
        # Random search
        for trial in range(1, max_trials + 1):
            # Check time budget
            elapsed = time.time() - start_time
            if elapsed > time_budget_sec:
                print(f"\n⏱ Time budget ({time_budget_min} min) reached. Stopping.")
                break
            
            # Generate random config
            config = self.generate_random_config()
            
            # Evaluate
            print(f"Trial {trial}: ", end='', flush=True)
            pass_rate, report = self.evaluate(config)
            print(f"Pass rate: {pass_rate*100:.1f}% | Avg score: {report['avg_score']:.3f}")
            
            # Update best
            if pass_rate > self.best_score:
                self.best_score = pass_rate
                self.best_config = config
                self.best_report = report
                print(f"  ✓ New best! Pass rate: {pass_rate*100:.1f}%")
            
            # Early stop
            if early_stop and pass_rate >= target_pass:
                print(f"\n✓ Target pass rate {target_pass*100}% reached after {trial} trials!")
                break
        
        elapsed_min = (time.time() - start_time) / 60
        print(f"\n🏁 Search complete in {elapsed_min:.1f} min")
        print(f"   Best pass rate: {self.best_score*100:.1f}%")
        print(f"   Best avg score: {self.best_report['avg_score']:.3f}")
        
        return self.best_config, self.best_report
    
    def save_results(self, config_path: str, report_path: str):
        """Save best config and report"""
        config_path = Path(config_path)
        report_path = Path(report_path)
        
        # Ensure dirs exist
        config_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Save config
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(self.best_config, f, indent=2)
        print(f"✓ Saved best config to {config_path}")
        
        # Save report (Markdown)
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write("# Baseline Tuning Report\n\n")
            f.write(f"**Pass Rate**: {self.best_score*100:.1f}%\n")
            f.write(f"**Avg Score**: {self.best_report['avg_score']:.3f}\n")
            f.write(f"**Passes**: {self.best_report['passes']}/{self.best_report['total']}\n\n")
            
            f.write("## Score Distribution\n\n")
            f.write("| Range | Count |\n")
            f.write("|-------|-------|\n")
            for range_name, count in self.best_report['score_distribution'].items():
                f.write(f"| {range_name} | {count} |\n")
            
            f.write("\n## Best Config\n\n```json\n")
            f.write(json.dumps(self.best_config, indent=2))
            f.write("\n```\n\n")
            
            f.write("## Sample Results (First 5)\n\n")
            for i, res in enumerate(self.best_report['detailed_results'][:5], 1):
                f.write(f"### {i}. {res['id']}\n\n")
                f.write(f"**Text**: {res['text']}\n\n")
                f.write(f"**Expected**: {json.dumps(res['expected'], indent=2)}\n\n")
                f.write(f"**Got Events**: {[e['label'] for e in res['got']['events']]}\n")
                f.write(f"**Got Wheel**: {res['got']['wheel']['primary']}\n")
                f.write(f"**Got Valence**: {res['got']['valence']}\n")
                f.write(f"**Got Arousal**: {res['got']['arousal']}\n\n")
                f.write(f"**Score**: {res['score']['total']:.3f} ")
                f.write(f"(events: {res['score']['events_score']:.3f}, ")
                f.write(f"wheel: {res['score']['wheel_score']:.3f}, ")
                f.write(f"valence: {res['score']['valence_score']:.3f}, ")
                f.write(f"arousal: {res['score']['arousal_score']:.3f})\n\n")
        
        print(f"✓ Saved report to {report_path}")


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Tune baseline enricher')
    parser.add_argument('--data', type=str, default='data/eval/baseline_50.jsonl', help='Path to baseline_50.jsonl')
    parser.add_argument('--out', type=str, default='baseline/best_config.json', help='Output path for best config')
    parser.add_argument('--report', type=str, default='reports/baseline_tuning_report.md', help='Output path for report')
    parser.add_argument('--target-pass', type=float, default=0.60, help='Target pass rate (0.60 = 60%%)')
    parser.add_argument('--max-trials', type=int, default=200, help='Max number of trials')
    parser.add_argument('--time-budget-min', type=float, default=15.0, help='Max time budget in minutes')
    
    args = parser.parse_args()
    
    # Run tuning
    tuner = BaselineTuner(args.data)
    best_config, best_report = tuner.tune(
        max_trials=args.max_trials,
        time_budget_min=args.time_budget_min,
        target_pass=args.target_pass,
        early_stop=True
    )
    
    # Save results
    tuner.save_results(args.out, args.report)
    
    print(f"\n✅ Tuning complete!")
    print(f"   Best pass rate: {tuner.best_score*100:.1f}%")
    print(f"   Config saved to: {args.out}")
    print(f"   Report saved to: {args.report}")
