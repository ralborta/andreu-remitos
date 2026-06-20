#!/usr/bin/env python3
"""Procesa todos los remitos Beraldi con foundation model v1.5-pro (zero-shot)."""
import base64
import json
import subprocess
import urllib.request
from pathlib import Path

PROJECT = "kiev-prueba"
LOCATION = "us"
PROCESSOR = "a892de713a557488"
VERSION = "pretrained-foundation-model-v1.5-pro-2025-06-20"
BERALDI_DIR = Path("/Users/ralborta/Andreu/Beraldi")
OUT = Path("/Users/ralborta/Andreu/samples/beraldi-foundation-resultados.json")

FILES = sorted(BERALDI_DIR.glob("*"))


def token():
    return subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()


def schema():
    with open("/Users/ralborta/Andreu/scripts/gcp/schema-beraldi.json") as f:
        ds = json.load(f)["documentSchema"]
    for et in ds.get("entityTypes", []):
        et.pop("entityTypeMetadata", None)
        for p in et.get("properties", []):
            p.pop("propertyMetadata", None)
    return ds


def process(path: Path):
    content = base64.b64encode(path.read_bytes()).decode()
    mime = "image/jpeg" if path.suffix.lower() in (".jpg", ".jpeg") else "application/octet-stream"
    body = {
        "rawDocument": {"content": content, "mimeType": mime},
        "processOptions": {"schemaOverride": schema()},
    }
    url = (
        f"https://{LOCATION}-documentai.googleapis.com/v1/projects/{PROJECT}/"
        f"locations/{LOCATION}/processors/{PROCESSOR}/processorVersions/{VERSION}:process"
    )
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {token()}",
            "Content-Type": "application/json",
            "X-Goog-User-Project": PROJECT,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        doc = json.load(r)["document"]
    entities = {
        e["type"]: e.get("mentionText") or (e.get("normalizedValue") or {}).get("text") or ""
        for e in doc.get("entities", [])
    }
    return {"archivo": path.name, "campos": entities, "texto_len": len(doc.get("text") or "")}


def main():
    resultados = [process(p) for p in FILES if p.suffix.lower() in (".jpg", ".jpeg")]
    OUT.write_text(json.dumps(resultados, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Procesados {len(resultados)} remitos → {OUT}")
    for r in resultados:
        c = r["campos"]
        print(f"\n{r['archivo']}:")
        print(f"  remito={c.get('nro_remito')} fecha={c.get('fecha')} chofer={c.get('chofer')}")
        print(f"  horas: ent={c.get('hora_carga_entrada')} sal={c.get('hora_carga_salida')} "
              f"ll={c.get('hora_descarga_llegada')} ini={c.get('hora_descarga_inicio')} fin={c.get('hora_descarga_fin')}")


if __name__ == "__main__":
    main()
