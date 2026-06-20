#!/usr/bin/env python3
"""Importa fotos Beraldi a Document AI desde GCS (archivo por archivo)."""
import json
import subprocess
import time
import urllib.request

PROCESSOR = "a892de713a557488"
PROJECT = "kiev-prueba"
LOCATION = "us"
BASE = f"https://{LOCATION}-documentai.googleapis.com/v1beta3/projects/{PROJECT}/locations/{LOCATION}/processors/{PROCESSOR}"

TRAIN = [f"gs://docai-kiev-beraldi/train/beraldi-train-{i:02d}.jpg" for i in range(1, 8)]
TEST = [f"gs://docai-kiev-beraldi/test/beraldi-test-{i:02d}.jpg" for i in range(1, 3)]


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


def get_op(name):
    op_url = f"https://{LOCATION}-documentai.googleapis.com/v1beta3/{name}"
    req = urllib.request.Request(op_url, headers=headers())
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def wait_op(name, timeout=300):
    deadline = time.time() + timeout
    while time.time() < deadline:
        op = get_op(name)
        state = op.get("metadata", {}).get("commonMetadata", {}).get("state", "")
        if op.get("done"):
            if "error" in op:
                raise RuntimeError(json.dumps(op["error"], indent=2))
            return op
        print(f"  ... {state or 'RUNNING'}")
        time.sleep(5)
    raise TimeoutError(name)


def import_one(uri, split):
    print(f"Importando {uri} → {split}")
    body = {
        "batchDocumentsImportConfigs": [{
            "datasetSplit": split,
            "batchInputConfig": {
                "gcsDocuments": {
                    "documents": [{"gcsUri": uri, "mimeType": "image/jpeg"}]
                }
            }
        }]
    }
    op = api("POST", "/dataset:importDocuments", body)
    wait_op(op["name"])
    print("  OK")


def main():
    with open("/Users/ralborta/Andreu/scripts/gcp/schema-beraldi.json") as f:
        schema = json.load(f)
    api("PATCH", "/dataset/datasetSchema?updateMask=documentSchema", schema)
    print("Schema OK (14 campos)\n")

    for uri in TRAIN:
        import_one(uri, "DATASET_SPLIT_TRAIN")
    for uri in TEST:
        import_one(uri, "DATASET_SPLIT_TEST")

    print(f"\nListo: {len(TRAIN)} train + {len(TEST)} test importados.")


if __name__ == "__main__":
    main()
