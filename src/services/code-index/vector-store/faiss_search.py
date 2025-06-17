#!/usr/bin/env python3
import sys
import subprocess

# --- Self-bootstrap: install dependencies if missing ---
def ensure_package(pkg):
    try:
        __import__(pkg)
    except ImportError:
        print(f"[faiss_search.py] Installing missing package: {pkg}", file=sys.stderr)
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])

# Ensure numpy and faiss-cpu are installed
ensure_package("numpy")
ensure_package("faiss-cpu")  # or "faiss" if using GPU

import argparse
import json
import os
import numpy as np
import faiss_cpu as faiss

def load_vectors(bundle_path):
    if os.path.exists(bundle_path) and bundle_path.endswith('.npy'):
        return np.load(bundle_path)
    elif os.path.exists(bundle_path):
        with open(bundle_path, 'r') as f:
            arr = json.load(f)
        return np.array(arr, dtype=np.float32)
    else:
        raise FileNotFoundError(f"Could not find vectors at {bundle_path}")

def load_texts(bundle_path):
    texts_path = bundle_path + '.json'
    if not os.path.exists(texts_path):
        raise FileNotFoundError(f"Could not find texts at {texts_path}")
    with open(texts_path, 'r') as f:
        return json.load(f)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--bundle', required=True, help='Path to vectors file (.npy or .json)')
    parser.add_argument('--query', required=True, help='Query embedding as JSON array')
    parser.add_argument('--topn', type=int, default=5, help='Number of results to return')
    args = parser.parse_args()

    vectors = load_vectors(args.bundle)
    texts = load_texts(args.bundle)
    if len(texts) != len(vectors):
        print(json.dumps({"error": "Texts and vectors length mismatch"}), file=sys.stderr)
        sys.exit(1)

    query = np.array(json.loads(args.query), dtype=np.float32)
    if query.shape[0] != vectors.shape[1]:
        print(json.dumps({"error": "Query dimension does not match vectors"}), file=sys.stderr)
        sys.exit(1)

    index = faiss.IndexFlatL2(vectors.shape[1])
    index.add(vectors)
    D, I = index.search(query.reshape(1, -1), args.topn)
    indices = I[0]
    distances = D[0]

    results = []
    for idx, dist in zip(indices, distances):
        results.append({"text": texts[idx], "score": float(dist)})
    print(json.dumps(results))

if __name__ == '__main__':
    main() 