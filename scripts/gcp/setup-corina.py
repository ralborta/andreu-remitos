#!/usr/bin/env python3
"""
Setup Document AI — remitos Quilmes / Corina (viajes cortos).

Requisitos:
  - Crear un Custom Extractor en GCP (Console → Document AI → Create processor)
  - Copiar el processor ID en CORINA_PROCESSOR abajo o export CORINA_PROCESSOR=...
  - Fotos de entrenamiento en /Users/ralborta/Andreu/Corina/*.png|jpg|jpeg

Uso:
  python3 scripts/gcp/setup-corina.py
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

PROJECT = "kiev-prueba"
LOCATION = "us"
PROCESSOR = os.environ.get("CORINA_PROCESSOR", "7d79a40a1c31244").strip()
BASE_MODEL = "pretrained-foundation-model-v1.5-pro-2025-06-20"
BUCKET = "gs://docai-kiev-beraldi/corina"
CORINA_DIR = Path("/Users/ralborta/Andreu/Corina")
ROOT = Path(__file__).resolve().parents[2]

DATASET = None
_SCHEMA = None


def token():
    return subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()


def headers():
    return {
        "Authorization": f"Bearer {token()}",
        "Content-Type": "application/json",
        "X-Goog-User-Project": PROJECT,
    }


def wait_op(name, timeout=600):
    url = f"https://{LOCATION}-documentai.googleapis.com/v1/{name}"
    deadline = time.time() + timeout
    while time.time() < deadline:
        req = urllib.request.Request(url, headers=headers())
        with urllib.request.urlopen(req, timeout=60) as r:
            op = json.loads(r.read())
        if op.get("done"):
            if op.get("error"):
                raise RuntimeError(json.dumps(op["error"], indent=2))
            return op
        st = op.get("metadata", {}).get("commonMetadata", {}).get("state", "RUNNING")
        print(f"  ... {st}")
        time.sleep(5)
    raise TimeoutError(name)


def list_corina_files():
    if not CORINA_DIR.is_dir():
        raise FileNotFoundError(f"No existe {CORINA_DIR} — copiá ahí los remitos Quilmes")
    files = sorted(
        p
        for p in CORINA_DIR.iterdir()
        if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")
    )
    if len(files) < 2:
        raise RuntimeError(f"Se necesitan al menos 2 imágenes en {CORINA_DIR}")
    split = max(1, len(files) // 5)
    train = files[:-split] if split < len(files) else files[:-1]
    test = files[-split:] if split < len(files) else files[-1:]
    return train, test


def schema_doc():
    global _SCHEMA
    if _SCHEMA:
        return _SCHEMA
    with open(ROOT / "scripts/gcp/schema-corina.json") as f:
        ds = json.load(f)["documentSchema"]
    for et in ds.get("entityTypes", []):
        et.pop("entityTypeMetadata", None)
        for p in et.get("properties", []):
            p.pop("propertyMetadata", None)
    _SCHEMA = ds
    return ds


def init_dataset():
    global DATASET
    DATASET = f"projects/{PROJECT}/locations/{LOCATION}/processors/{PROCESSOR}/dataset"
    api = f"https://{LOCATION}-documentai.googleapis.com/v1beta3/{DATASET}"

    init = {
        "name": DATASET,
        "unmanagedDatasetConfig": {},
        "spannerIndexingConfig": {},
    }
    req = urllib.request.Request(
        f"{api}?updateMask=unmanagedDatasetConfig,spannerIndexingConfig",
        data=json.dumps(init).encode(),
        headers=headers(),
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            json.load(r)
        time.sleep(8)
    except urllib.error.HTTPError:
        pass

    with open(ROOT / "scripts/gcp/schema-corina.json") as f:
        schema = json.load(f)
    req = urllib.request.Request(
        f"{api}/datasetSchema?updateMask=documentSchema",
        data=json.dumps(schema).encode(),
        headers=headers(),
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        json.load(r)
    schema_doc()
    print("Schema Corina OK (12 campos)")


def mime_for(name):
    ext = Path(name).suffix.lower()
    if ext == ".png":
        return "image/png"
    if ext == ".webp":
        return "image/webp"
    return "image/jpeg"


def upload_gcs(train, test):
    subprocess.run(
        ["gsutil", "mb", "-p", PROJECT, "-l", "US", BUCKET.replace("gs://", "")],
        stderr=subprocess.DEVNULL,
        check=False,
    )
    mapping = []
    for i, path in enumerate(train, 1):
        dst = f"{BUCKET}/train/corina-train-{i:02d}{path.suffix.lower()}"
        subprocess.check_call(["gsutil", "-q", "cp", str(path), dst])
        mapping.append((dst, "DATASET_SPLIT_TRAIN"))
        print(f"  upload {path.name} -> {dst}")
    for i, path in enumerate(test, 1):
        dst = f"{BUCKET}/test/corina-test-{i:02d}{path.suffix.lower()}"
        subprocess.check_call(["gsutil", "-q", "cp", str(path), dst])
        mapping.append((dst, "DATASET_SPLIT_TEST"))
        print(f"  upload {path.name} -> {dst}")
    return mapping


def urlopen_json(req, timeout=300):
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def process_image(gcs_uri, retries=3):
    local = f"/tmp/{gcs_uri.split('/')[-1]}"
    subprocess.check_call(["gsutil", "-q", "cp", gcs_uri, local])
    body = {
        "rawDocument": {
            "content": base64.b64encode(open(local, "rb").read()).decode(),
            "mimeType": mime_for(local),
        },
        "processOptions": {"schemaOverride": schema_doc()},
    }
    url = (
        f"https://{LOCATION}-documentai.googleapis.com/v1/projects/{PROJECT}/"
        f"locations/{LOCATION}/processors/{PROCESSOR}/processorVersions/{BASE_MODEL}:process"
    )
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers(), method="POST")
            doc = urlopen_json(req, timeout=300)["document"]
            break
        except Exception as e:
            last_err = e
            print(f"  retry {attempt}/{retries} {Path(gcs_uri).name}: {e}")
            time.sleep(10)
    else:
        raise last_err
    json_uri = json_uri.replace("/train/", "/labeled-json/train/").replace("/test/", "/labeled-json/test/")
    if "/corina/" in gcs_uri and "/labeled-json/" not in json_uri:
        json_uri = gcs_uri.replace(f"{BUCKET}/train/", f"{BUCKET}/labeled-json/train/").replace(
            f"{BUCKET}/test/", f"{BUCKET}/labeled-json/test/"
        ).rsplit(".", 1)[0] + ".json"
    local_json = f"/tmp/{Path(json_uri).name}"
    open(local_json, "w", encoding="utf-8").write(json.dumps(doc))
    subprocess.check_call(["gsutil", "-q", "cp", local_json, json_uri])
    print(f"  {Path(gcs_uri).name} -> {len(doc.get('entities', []))} campos")
    return json_uri


def import_json(gcs_json, split):
    api = f"https://{LOCATION}-documentai.googleapis.com/v1beta3/{DATASET}"
    body = {
        "batchDocumentsImportConfigs": [{
            "datasetSplit": split,
            "batchInputConfig": {
                "gcsDocuments": {
                    "documents": [{"gcsUri": gcs_json, "mimeType": "application/json"}]
                }
            },
        }]
    }
    req = urllib.request.Request(
        f"{api}:importDocuments",
        data=json.dumps(body).encode(),
        headers=headers(),
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        op = json.loads(r.read())
    wait_op(op["name"])


def create_foundation():
    body = {
        "processorVersion": {
            "displayName": "corina-foundation-v1",
            "modelType": "MODEL_TYPE_GENERATIVE",
        },
        "documentSchema": schema_doc(),
        "baseProcessorVersion": (
            f"projects/{PROJECT}/locations/{LOCATION}/processors/{PROCESSOR}/"
            f"processorVersions/{BASE_MODEL}"
        ),
    }
    url = f"https://{LOCATION}-documentai.googleapis.com/v1/projects/{PROJECT}/locations/{LOCATION}/processors/{PROCESSOR}/processorVersions:train"
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers(), method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        op = json.loads(r.read())
    print("Creando corina-foundation-v1...")
    result = wait_op(op["name"], timeout=900)
    pv = result.get("response", {}).get("processorVersion", "").split("/")[-1]
    if not pv:
        pv = result.get("response", {}).get("name", "").split("/")[-1]
    if not pv:
        raise RuntimeError("No version id in train response")
    pv_full = f"projects/{PROJECT}/locations/{LOCATION}/processors/{PROCESSOR}/processorVersions/{pv}"

    req = urllib.request.Request(
        f"https://{LOCATION}-documentai.googleapis.com/v1/{pv_full}:deploy",
        data=b"{}",
        headers=headers(),
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        dep = json.loads(r.read())
    wait_op(dep["name"], timeout=300)

    req = urllib.request.Request(
        f"https://{LOCATION}-documentai.googleapis.com/v1/projects/{PROJECT}/locations/{LOCATION}/processors/{PROCESSOR}:setDefaultProcessorVersion",
        data=json.dumps({"defaultProcessorVersion": pv_full}).encode(),
        headers=headers(),
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        json.load(r)
    print(f"corina-foundation-v1 listo: {pv}")
    return pv


def update_env(pv_id):
    keys = {
        "DOCUMENT_AI_CUSTOM_CORINA_ID": PROCESSOR,
        "DOCUMENT_AI_CORINA_VERSION": pv_id,
    }
    for env_path in (ROOT / ".env", ROOT / "backend/.env"):
        if not env_path.exists():
            continue
        lines = env_path.read_text().splitlines()
        for k, v in keys.items():
            found = False
            for i, line in enumerate(lines):
                if line.startswith(f"{k}="):
                    lines[i] = f"{k}={v}"
                    found = True
            if not found:
                lines.append(f"{k}={v}")
        env_path.write_text("\n".join(lines) + "\n")


def main():
    global PROCESSOR
    if not PROCESSOR:
        print("ERROR: definí CORINA_PROCESSOR con el ID del Custom Extractor en GCP")
        print("  export CORINA_PROCESSOR=xxxxxxxx")
        sys.exit(1)

    train, test = list_corina_files()
    print(f"Train: {len(train)} · Test: {len(test)}")

    print("1) Subiendo fotos a GCS...")
    files = upload_gcs(train, test)

    print("\n2) Schema + dataset...")
    init_dataset()

    print("\n3) Pre-etiquetando con foundation...")
    labeled = [(process_image(uri), split) for uri, split in files]

    print("\n4) Importando JSON al dataset...")
    for json_uri, split in labeled:
        print(f"  import {Path(json_uri).name}")
        import_json(json_uri, split)

    print("\n5) Creando corina-foundation-v1...")
    pv_id = create_foundation()
    update_env(pv_id)
    print(f"\nDONE. DOCUMENT_AI_CORINA_VERSION={pv_id}")


if __name__ == "__main__":
    main()
