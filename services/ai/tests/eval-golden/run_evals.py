"""
Golden Dataset Eval Runner — tests agents against curated prompts and produces quality reports.

Usage:
    python -m tests.eval_golden.run_evals                    # Run all verticals
    python -m tests.eval_golden.run_evals --vertical legal    # Run one vertical
    python -m tests.eval_golden.run_evals --tool document_intelligence  # Run one tool
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


def load_golden_dataset() -> Dict[str, Any]:
    """Load the golden test dataset."""
    dataset_path = Path(__file__).parent / "golden_dataset.json"
    with open(dataset_path) as f:
        return json.load(f)


def evaluate_response(
    prompt: str,
    response: str,
    expected: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Evaluate a single response against expected behavior.
    Uses heuristic scoring (no LLM call needed for the eval runner itself).
    """
    scores = {}

    # Relevance: check if the response mentions key terms from the prompt
    prompt_words = set(prompt.lower().split())
    response_words = set(response.lower().split())
    overlap = len(prompt_words & response_words) / max(len(prompt_words), 1)
    scores["relevance"] = min(1.0, overlap * 2.5)

    # Completeness: length-based + structure check
    if len(response) > 2000:
        scores["completeness"] = 0.9
    elif len(response) > 500:
        scores["completeness"] = 0.7
    elif len(response) > 100:
        scores["completeness"] = 0.5
    else:
        scores["completeness"] = 0.3

    # Check for expected patterns from scoring_criteria
    criteria = expected.get("scoring_criteria", {})

    # Accuracy: heuristic — does it cite specific laws/sections/numbers?
    import re
    has_citations = bool(re.search(r'(?:Section|Article|Rule|Act|Case|§)\s+\d+', response))
    has_numbers = bool(re.search(r'\d{4}|\d+%', response))
    if has_citations and has_numbers:
        scores["accuracy"] = 0.85
    elif has_citations or has_numbers:
        scores["accuracy"] = 0.7
    else:
        scores["accuracy"] = 0.5

    # Safety: check for harmful content
    harmful = re.search(r'\b(?:kill|murder|hack|bomb|bribe)\b', response, re.IGNORECASE)
    scores["safety"] = 0.2 if harmful else 0.95

    # Usability: check for structure
    has_structure = bool(re.search(r'(?:^|\n)[#*\-1]', response))
    scores["usability"] = 0.85 if has_structure else 0.6

    # Overall score (weighted)
    weights = {"relevance": 0.25, "completeness": 0.20, "accuracy": 0.25, "safety": 0.15, "usability": 0.15}
    overall = sum(scores.get(dim, 0.5) * w for dim, w in weights.items())

    return {
        "scores": scores,
        "overall": round(overall, 3),
        "passed": overall >= 0.7,
        "length": len(response),
    }


def run_evals(
    vertical: Optional[str] = None,
    tool: Optional[str] = None,
    api_base: str = "http://localhost:8000",
) -> Dict[str, Any]:
    """
    Run evals against the golden dataset.
    
    In production, this would call the AI service endpoints.
    For now, it validates the dataset and scoring logic.
    """
    dataset = load_golden_dataset()
    results = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_prompts": 0,
        "evaluated": 0,
        "passed": 0,
        "failed": 0,
        "avg_score": 0,
        "by_vertical": {},
        "by_tool": {},
        "failures": [],
    }

    verticals = dataset["verticals"]
    if vertical:
        verticals = {vertical: verticals.get(vertical, {})}

    all_scores = []

    for vert_name, vert_data in verticals.items():
        prompts = vert_data.get("prompts", [])
        vert_results = {"total": len(prompts), "passed": 0, "failed": 0, "avg_score": 0}
        vert_scores = []

        for prompt_entry in prompts:
            results["total_prompts"] += 1

            if tool and prompt_entry.get("expected_tool") != tool:
                continue

            # In production, we'd call the AI service here:
            # response = call_ai_service(api_base, prompt_entry["prompt"])

            # For now, validate the dataset entry
            if not prompt_entry.get("id"):
                continue
            if not prompt_entry.get("prompt"):
                continue
            if not prompt_entry.get("expected_tool"):
                continue

            results["evaluated"] += 1

            # Validate scoring criteria
            criteria = prompt_entry.get("scoring_criteria", {})
            for dim in ["relevance", "completeness", "accuracy"]:
                if dim not in criteria:
                    print(f"  WARNING: {prompt_entry['id']} missing scoring_criteria.{dim}")

            # Track by tool
            tool_name = prompt_entry["expected_tool"]
            if tool_name not in results["by_tool"]:
                results["by_tool"][tool_name] = {"total": 0, "prompts": []}
            results["by_tool"][tool_name]["total"] += 1
            results["by_tool"][tool_name]["prompts"].append(prompt_entry["id"])

        if vert_scores:
            vert_results["avg_score"] = round(sum(vert_scores) / len(vert_scores), 3)

        results["by_vertical"][vert_name] = vert_results

    if all_scores:
        results["avg_score"] = round(sum(all_scores) / len(all_scores), 3)

    return results


def print_report(results: Dict[str, Any]):
    """Print a formatted eval report."""
    print("\n" + "=" * 60)
    print("  COUNSEL AI — Golden Dataset Eval Report")
    print("=" * 60)
    print(f"  Timestamp:  {results['timestamp']}")
    print(f"  Prompts:    {results['total_prompts']}")
    print(f"  Evaluated:  {results['evaluated']}")
    print(f"  Passed:     {results['passed']}")
    print(f"  Failed:     {results['failed']}")
    print(f"  Avg Score:  {results['avg_score']}")
    print()

    print("  By Vertical:")
    for vert, stats in results["by_vertical"].items():
        print(f"    {vert:15s} — {stats['total']} prompts")

    print()
    print("  By Tool:")
    for tool_name, stats in results["by_tool"].items():
        print(f"    {tool_name:25s} — {stats['total']} prompts ({', '.join(stats['prompts'][:3])}...)")

    if results["failures"]:
        print()
        print("  Failures:")
        for f in results["failures"]:
            print(f"    ❌ {f['id']}: {f['reason']}")

    print()
    print("=" * 60)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run golden dataset evals")
    parser.add_argument("--vertical", help="Run only one vertical (legal, consulting, ca)")
    parser.add_argument("--tool", help="Run only prompts for a specific tool")
    parser.add_argument("--api-base", default="http://localhost:8000", help="AI service URL")
    args = parser.parse_args()

    results = run_evals(
        vertical=args.vertical,
        tool=args.tool,
        api_base=args.api_base,
    )
    print_report(results)

    # Exit code: 0 if all pass, 1 if any fail
    sys.exit(0 if results["failed"] == 0 else 1)
