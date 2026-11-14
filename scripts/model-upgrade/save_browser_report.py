"""Save the JSON-string result returned by Playwright CLI eval --raw from stdin."""
import json
import sys
from pathlib import Path

report = json.load(sys.stdin)
if isinstance(report, str):
    report = json.loads(report)
target = Path(__file__).resolve().parents[2] / 'output/playwright/model-upgrade/report.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(report, indent=2, ensure_ascii=True)+'\n', encoding='utf-8')
print(json.dumps({'stations': [s['id'] for s in report['stations']],
    'issues': report['issues'], 'errors': report['errors'], 'report': str(target)}))
if len(report['stations']) != 5 or report['issues'] or report['errors']:
    sys.exit(1)
