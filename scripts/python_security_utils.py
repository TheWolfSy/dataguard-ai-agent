import os
import hashlib
import json
import argparse
from datetime import datetime


def normalize_path(path: str, root: str) -> str:
    rel = os.path.relpath(path, root)
    return rel.replace('\\', '/')


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_file(file_path: str) -> str:
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def get_env_var(name: str, default: str = "") -> str:
    return os.getenv(name, default)


def scan_tree(root: str) -> dict:
    snapshot = {}

    for current_root, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in {'.git', 'node_modules', 'dist', '__pycache__'}]

        rel_dir = normalize_path(current_root, root)
        if rel_dir != '.':
            snapshot[rel_dir] = {
                'type': 'folder',
                'hash': None,
            }

        for filename in files:
            abs_file = os.path.join(current_root, filename)
            rel_file = normalize_path(abs_file, root)
            snapshot[rel_file] = {
                'type': 'file',
                'hash': sha256_file(abs_file),
            }

    return snapshot


def build_baseline(root: str, baseline_file: str) -> None:
    data = {
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'root': os.path.abspath(root),
        'test_round': 1,
        'snapshot': scan_tree(root),
    }
    with open(baseline_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def compare_with_baseline(root: str, baseline_file: str, output_file: str) -> None:
    with open(baseline_file, 'r', encoding='utf-8') as f:
        baseline = json.load(f)

    current = scan_tree(root)
    previous = baseline.get('snapshot', {})

    all_paths = sorted(set(previous.keys()) | set(current.keys()))
    changes = []

    for path in all_paths:
        prev = previous.get(path)
        curr = current.get(path)

        if prev is None and curr is not None:
            changes.append({
                'path': path,
                'type': curr['type'],
                'previous_hash': None,
                'current_hash': curr['hash'],
                'change_status': 'NEW',
            })
            continue

        if prev is not None and curr is None:
            changes.append({
                'path': path,
                'type': prev['type'],
                'previous_hash': prev['hash'],
                'current_hash': None,
                'change_status': 'REMOVED',
            })
            continue

        status = 'UNCHANGED' if prev['hash'] == curr['hash'] else 'MODIFIED'
        changes.append({
            'path': path,
            'type': curr['type'],
            'previous_hash': prev['hash'],
            'current_hash': curr['hash'],
            'change_status': status,
        })

    report = {
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'root': os.path.abspath(root),
        'test_round': 2,
        'changes': changes,
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Filesystem scanner using os/hashlib')
    parser.add_argument('--root', default='.', help='Directory to scan')
    parser.add_argument('--baseline', default='audit_baseline.json', help='Baseline file path')
    parser.add_argument('--output', default='audit_report_round2.json', help='Second test report output file')
    parser.add_argument('--mode', choices=['baseline', 'compare'], required=True)
    args = parser.parse_args()

    if args.mode == 'baseline':
        build_baseline(args.root, args.baseline)
        print(f'Baseline saved to {args.baseline}')
    else:
        compare_with_baseline(args.root, args.baseline, args.output)
        print(f'Second test report saved to {args.output}')
