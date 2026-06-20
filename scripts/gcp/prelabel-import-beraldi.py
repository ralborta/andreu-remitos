#!/usr/bin/env python3
"""Genera JSON pre-etiquetados con foundation y los importa al dataset Workbench."""
import base64
import json
import subprocess
import time
import urllib.error
import urllib.request

PROJECT = "kiev-prueba"
LOCATION = "us"
PROCESSOR = "a892de713a557488"
VERSION = "pretrained-foundation-model-v1.5-pro-2025-06-20"
BUCKET = "gs://docai-kiev-beraldi"
DATASET = f"projects/{PROJECT}/locations/{LOCATION}/processors/{PROCESSOR}/dataset"
BASE = f"https://{LOCATION}-documentai.googleapis.com/v1beta3/{DATASET}"

TRAIN = [f"{BUCKET}/train/beraldi-train-{i:02d}.jpg" for i in range(1, 8)]
TEST = [f"{BUCKET}/test/beraldi-test-{i:02d}.jpg" for i in range(1, 3)]


def token():
    return subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()


def headers():
    return {
        "Authorization": f"Bearer {token()}",
        "Content-Type": "application/json",
        "X-Goog-User-Project": PROJECT,
    }


def api(method, path, body=None):
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(body).encode() if body else None,
        headers=headers(),
        method=method,
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def wait_op(name, timeout=300):
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
        state = op.get("metadata", {}).get("commonMetadata", {}).get("state", "RUNNING")
        print(f"  ... {state}")
        time.sleep(4)
    raise TimeoutError(name)


def schema():
    with open("/Users/ralborta/Andreu/scripts/gcp/schema-beraldi.json") as f:
        ds = json.load(f)["documentSchema"]
    for et in ds.get("entityTypes", []):
        et.pop("entityTypeMetadata", None)
        for p in et.get("properties", []):
            p.pop("propertyMetadata", None)
    return ds


def process_image(gcs_jpg):
    local_jpg = f"/tmp/{gcs_jpg.split('/')[-1]}"
    local_json = local_jpg.replace(".jpg", ".json")
    gcs_json = gcs_jpg.replace("/train/", "/labeled-json/train/").replace("/test/", "/labeled-json/test/").replace(".jpg", ".json")

    subprocess.check_call(["gsutil", "-q", "cp", gcs_jpg, local_jpg])
    body = {
        "rawDocument": {
            "content": base64.b64encode(open(local_jpg, "rb").read()).decode(),
            "mimeType": "image/jpeg",
        },
        "processOptions": {"schemaOverride": schema()},
    }
    url = (
        f"https://{LOCATION}-documentai.googleapis.com/v1/projects/{PROJECT}/"
        f"locations/{LOCATION}/processors/{PROCESSOR}/processorVersions/{VERSION}:process"
    )
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers(), method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        doc = json.load(r)["document"]

    open(local_json, "w", encoding="utf-8").write(json.dumps(doc))
    subprocess.check_call(["gsutil", "-q", "cp", local_json, gcs_json])
    ents = len(doc.get("entities", []))
    print(f"  {gcs_jpg.split('/')[-1]} → {ents} campos → {gcs_json.split('/')[-1]}")
    return gcs_json


def list_doc_ids():
    req = urllib.request.Request(
        f"{BASE}:listDocuments",
        data=json.dumps({"pageSize": 50}).encode(),
        headers=headers(),
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        docs = json.loads(r.read()).get("documentMetadata", [])
    return [d["documentId"] for d in docs]


def delete_all_docs():
    ids = list_doc_ids()
    if not ids:
        print("Dataset vacío, nada que borrar.")
        return
    print(f"Borrando {len(ids)} documentos viejos...")
    body = {
        "dataset": DATASET,
        "datasetDocuments": {
            "individualDocumentIds": {"documentIds": ids},
        },
    }
    op = api("POST", ":batchDeleteDocuments", body)
    wait_op(op["name"])
    print("  OK")


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
    op = api("POST", ":importDocuments", body)
    wait_op(op["name"])


def main():
    print("1) Procesando fotos con foundation model...")
    train_jsons = [process_image(u) for u in TRAIN]
    test_jsons = [process_image(u) for u in TEST]

    print("\n2) Limpiando dataset (auto-label de Google no funciona)...")
    delete_all_docs()

    print("\n3) Importando JSON pre-etiquetados...")
    for uri in train_jsons:
        print(f"Import train {uri.split('/')[-1]}")
        import_json(uri, "DATASET_SPLIT_TRAIN")
    for uri in test_jsons:
        print(f"Import test {uri.split('/')[-1]}")
        import_json(uri, "DATASET_SPLIT_TEST")

    req = urllib.request.Request(
        f"{BASE}:listDocuments",
        data=json.dumps({"pageSize": 20}).encode(),
        headers=headers(),
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        docs = json.loads(r.read()).get("documentMetadata", [])
    labeled = sum(1 for d in docs if d.get("labelingState") == "DOCUMENT_LABELED")
    print(f"\nListo: {labeled}/{len(docs)} documentos ETIQUETADOS en Workbench.")


if __name__ == "__main__":
    main()
