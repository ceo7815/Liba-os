import json
import sys
from pathlib import Path

import pymupdf

sys.stdout.reconfigure(encoding="utf-8")

docs = []
for raw in sys.argv[1:]:
    path = Path(raw)
    document = pymupdf.open(path)
    text = "\n".join(page.get_text("text") for page in document)
    docs.append({"name": path.name, "text": text})

json.dump(docs, sys.stdout, ensure_ascii=False)
