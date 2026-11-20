"""Record installed/lockfile provenance; not a legal opinion."""
import json
import subprocess
from pathlib import Path
from datetime import datetime, timezone

root = Path(__file__).resolve().parent.parent
lock = json.loads((root / 'package-lock.json').read_text())
rows, runtime_texts = [], []
for relative, data in sorted(lock['packages'].items()):
    if not relative:
        continue
    directory = root / relative
    installed = directory / 'package.json'
    meta = json.loads(installed.read_text()) if installed.exists() else {}
    name = meta.get('name', relative.split('node_modules/')[-1])
    license_value = meta.get('license', data.get('license', 'UNSPECIFIED'))
    license_files = [p for p in directory.iterdir() if p.is_file() and p.name.lower().startswith(('license', 'licence', 'copying', 'notice'))] if directory.exists() else []
    row = dict(name=name, version=data['version'], scope='development' if data.get('dev') else 'runtime', license=license_value, installed=bool(meta), package_url=f'https://www.npmjs.com/package/{name}/v/{data["version"]}', resolved=data.get('resolved'), license_files=[p.name for p in license_files])
    rows.append(row)
    if row['scope'] == 'runtime':
        if not meta or not license_files:
            raise RuntimeError(f'Missing installed runtime license: {name}')
        runtime_texts.append(f'\n{name} {row["version"]}\n{row["package_url"]}\nDeclared license: {license_value}\n')
        for file in license_files:
            runtime_texts.append(f'--- {file.name} ---\n{file.read_text(errors="replace")}\n')
report = dict(generated_at=datetime.now(timezone.utc).isoformat(), source='package-lock.json plus installed package metadata; platform-optional packages may not be installed', packages=rows)
docs = root / 'docs'
docs.mkdir(exist_ok=True)
(docs / 'dependency-licenses.json').write_text(json.dumps(report, indent=2) + '\n')
(root / 'public/DEPENDENCY_LICENSES.txt').write_text('Runtime dependency license texts copied from installed packages.\nSee THIRD_PARTY_NOTICES.txt for adapted Mini Golf Mania modules and additional attribution.\n' + '\n'.join(runtime_texts))
audits = {}
for key, args in [('all', []), ('runtime', ['--omit=dev'])]:
    proc = subprocess.run(['npm', 'audit', '--json', *args], cwd=root, text=True, capture_output=True)
    result = json.loads(proc.stdout)
    if 'error' in result:
        raise RuntimeError(result)
    audits[key] = result
    (docs / f'npm-audit-{key}.json').write_text(json.dumps(result, indent=2) + '\n')
runtime = [p for p in rows if p['scope'] == 'runtime']
text = f'''# Dependency audit

Generated: {report['generated_at']}.

Vite was upgraded from 4.4.9 to 8.3.8 and Vitest from 0.34.6 to 5.1.1 after npm registry engine/version checks. Runtime Three.js 0.155.0 and Rapier 0.11.2 are unchanged. Build and unit/browser compatibility must be verified separately from this report.

- All-dependency npm audit advisory count: {audits['all']['metadata']['vulnerabilities']['total']}.
- Runtime-only npm audit advisory count: {audits['runtime']['metadata']['vulnerabilities']['total']}.
- Lockfile entries catalogued (excluding root): {len(rows)}; installed entries: {sum(p['installed'] for p in rows)}.
- Runtime package entries: {len(runtime)}.
- Declared licenses: {', '.join(sorted({str(p['license']) for p in rows}))}.

See `dependency-licenses.json` for exact versions, npm URLs, resolved package URLs, declared license, installed state and discovered license filenames. Entries not installed here are typically platform-optional; their license declaration is taken from the lockfile, not independently from a package archive. Full runtime license texts ship in `public/DEPENDENCY_LICENSES.txt`. Upstream adapted MIT code notice remains in `public/THIRD_PARTY_NOTICES.txt` and `LICENSE.upstream`.

Audit absence is not proof of security; results reflect the registry advisories returned on this run. License metadata is an inventory, not legal certification. Original geometry, CSS/SVG interface and synthesized audio use no downloaded models, textures, music or fonts. Publication rights for original project code remain a separate owner decision; README grants no blanket license.

The application remains a static browser build; do not expose Vite's development server publicly. Development now requires a Node version accepted by Vite and Vitest; this run used the local Node installation recorded in RELEASE-POLISH.md.
'''
(docs / 'dependency-audit.md').write_text(text)
print(json.dumps({'lockfile_packages': len(rows), 'installed': sum(p['installed'] for p in rows), 'runtime': [p['name'] for p in runtime], 'vulnerabilities': {k:v['metadata']['vulnerabilities']['total'] for k,v in audits.items()}}, indent=2))
