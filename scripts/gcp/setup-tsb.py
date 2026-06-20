#!/usr/bin/env python3
"""Setup completo TSB: schema, GCS, pre-label, import, foundation, default."""
import base64
import json
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

PROJECT = "kiev-prueba"
LOCATION = "us"
PROCESSOR = "5b510d4ae17e6aba"
BASE_MODEL = "pretrained-foundation-model-v1.5-pro-2025-06-20"
BUCKET = "gs://docai-kiev-tsb"
TSB_DIR = Path("/Users/ralborta/Andreu/TSB")
ROOT = Path("/Users/ralborta/Andreu")

TRAIN_LOCAL = [
    "Remito TSB 1.jpg",
    "Remito TSB 2.jpg",
    "Remito TSB 3.jpg",
    "Remito TSB 4.jpg",
    "WhatsApp Image 2026-06-18 at 14.47.47.jpeg",
    "WhatsApp Image 2026-06-18 at 14.47.48.jpeg",
    "WhatsApp Image 2026-06-18 at 14.47.49.jpeg",
]
TEST_LOCAL = [
    "WhatsApp Image 2026-06-18 at 14.47.50.jpeg",
    "image011.png",
]

DATASET = f"projects/{PROJECT}/locations/{LOCATION}/processors/{PROCESSOR}/dataset"
API = f"https://{LOCATION}-documentai.googleapis.com/v1beta3/{DATASET}"
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


def schema_doc():
    global _SCHEMA
    if _SCHEMA:
        return _SCHEMA
    with open(ROOT / "scripts/gcp/schema-tsb.json") as f:
        ds = json.load(f)["documentSchema"]
    for et in ds.get("entityTypes", []):
        et.pop("entityTypeMetadata", None)
        for p in et.get("properties", []):
            p.pop("propertyMetadata", None)
    _SCHEMA = ds
    return ds


def init_dataset():
    init = {
        "name": DATASET,
        "unmanagedDatasetConfig": {},
        "spannerIndexingConfig": {},
    }
    req = urllib.request.Request(
        f"{API}?updateMask=unmanagedDatasetConfig,spannerIndexingConfig",
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

    with open(ROOT / "scripts/gcp/schema-tsb.json") as f:
        schema = json.load(f)
    req = urllib.request.Request(
        f"{API}/datasetSchema?updateMask=documentSchema",
        data=json.dumps(schema).encode(),
        headers=headers(),
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        json.load(r)
    schema_doc()
    print("Schema TSB OK (16 campos)")


def mime_for(name):
    return "image/png" if name.lower().endswith(".png") else "image/jpeg"


def upload_gcs():
    subprocess.run(
        ["gsutil", "mb", "-p", PROJECT, "-l", "US", BUCKET.replace("gs://", "")],
        stderr=subprocess.DEVNULL,
        check=False,
    )
    mapping = []
    for i, name in enumerate(TRAIN_LOCAL, 1):
        dst = f"{BUCKET}/train/tsb-train-{i:02d}{Path(name).suffix.lower()}"
        subprocess.check_call(["gsutil", "-q", "cp", str(TSB_DIR / name), dst])
        mapping.append((dst, "DATASET_SPLIT_TRAIN"))
        print(f"  upload {name} -> {dst}")
    for i, name in enumerate(TEST_LOCAL, 1):
        dst = f"{BUCKET}/test/tsb-test-{i:02d}{Path(name).suffix.lower()}"
        subprocess.check_call(["gsutil", "-q", "cp", str(TSB_DIR / name), dst])
        mapping.append((dst, "DATASET_SPLIT_TEST"))
        print(f"  upload {name} -> {dst}")
    return mapping


def process_image(gcs_uri):
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
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers(), method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        doc = json.load(r)["document"]
    json_uri = gcs_uri.rsplit(".", 1)[0] + ".json"
    json_uri = json_uri.replace("/train/", "/labeled-json/train/").replace("/test/", "/labeled-json/test/")
    local_json = f"/tmp/{Path(json_uri).name}"
    open(local_json, "w", encoding="utf-8").write(json.dumps(doc))
    subprocess.check_call(["gsutil", "-q", "cp", local_json, json_uri])
    print(f"  {Path(gcs_uri).name} -> {len(doc.get('entities', []))} campos")
    return json_uri


def import_json(gcs_json, split):
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
        f"{API}:importDocuments",
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
            "displayName": "tsb-foundation-v1",
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
    print("Creando tsb-foundation-v1...")
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
    print(f"tsb-foundation-v1 listo: {pv}")
    return pv


def update_env(pv_id):
    keys = {"DOCUMENT_AI_CUSTOM_TSB_ID": PROCESSOR, "DOCUMENT_AI_TSB_VERSION": pv_id}
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
    print("1) Subiendo fotos a GCS...")
    files = upload_gcs()

    print("\n2) Schema + dataset...")
    init_dataset()

    print("\n3) Pre-etiquetando con foundation...")
    labeled = [(process_image(uri), split) for uri, split in files]

    print("\n4) Importando JSON al dataset...")
    for json_uri, split in labeled:
        print(f"  import {Path(json_uri).name}")
        import_json(json_uri, split)

    print("\n5) Creando tsb-foundation-v1...")
    pv_id = create_foundation()
    update_env(pv_id)
    print(f"\nDONE. DOCUMENT_AI_TSB_VERSION={pv_id}")


if __name__ == "__main__":
    main()
