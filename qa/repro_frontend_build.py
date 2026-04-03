from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLIENT = ROOT / 'client'
PACKAGE_JSON = CLIENT / 'package.json'
NODE_MODULES = CLIENT / 'node_modules'
DIST = CLIENT / 'dist'
STATIC = ROOT / 'static'


def _run(cmd: list[str], cwd: Path, *, dry_run: bool) -> None:
    rendered = ' '.join(cmd)
    print(f'[frontend] {cwd}: {rendered}')
    if dry_run:
        return
    subprocess.run(cmd, cwd=str(cwd), check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description='Reproducible LangSuite frontend install/build/sync helper.')
    parser.add_argument('--skip-install', action='store_true', help='Do not run npm ci/npm install even if node_modules is missing.')
    parser.add_argument('--dry-run', action='store_true', help='Print the steps without executing them.')
    args = parser.parse_args()

    if not PACKAGE_JSON.exists():
        raise SystemExit('Missing client/package.json')

    if shutil.which('node') is None or shutil.which('npm') is None:
        raise SystemExit('node and npm must be available in PATH')

    package = json.loads(PACKAGE_JSON.read_text())
    scripts = package.get('scripts', {})
    if 'verify' not in scripts or 'build:static' not in scripts:
        raise SystemExit('package.json is missing the verify/build:static scripts expected by this helper')

    if not NODE_MODULES.exists() and not args.skip_install:
        install_cmd = ['npm', 'ci'] if (CLIENT / 'package-lock.json').exists() else ['npm', 'install']
        _run(install_cmd, CLIENT, dry_run=args.dry_run)
    elif not NODE_MODULES.exists():
        print('[frontend] node_modules missing; install skipped by flag')

    _run(['npm', 'run', 'verify'], CLIENT, dry_run=args.dry_run)

    if args.dry_run:
        return 0

    if not DIST.exists():
        raise SystemExit('client/dist missing after verify')
    if not (DIST / 'index.html').exists():
        raise SystemExit('client/dist/index.html missing after verify')
    if not (STATIC / 'index.html').exists():
        raise SystemExit('static/index.html missing after build:static sync')

    print('[frontend] Build + static sync completed successfully.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
