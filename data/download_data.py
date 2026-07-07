"""
Downloads the primary structured dataset for PrakashPD.

Dataset: "Default of Credit Card Clients" (UCI Machine Learning Repository)
https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients

Why this dataset instead of Home Credit / Lending Club / Give Me Some Credit:
those three are gated behind a Kaggle account + API token. This one is a
direct, unauthenticated download, so the whole pipeline runs on a laptop
with zero credentials. See README.md for the full "real vs simulated" note.
"""

import urllib.request
from pathlib import Path

RAW_DIR = Path(__file__).parent / "raw"
URL = (
    "https://archive.ics.uci.edu/ml/machine-learning-databases/00350/"
    "default%20of%20credit%20card%20clients.xls"
)
DEST = RAW_DIR / "default_of_credit_card_clients.xls"


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if DEST.exists():
        print(f"Already downloaded: {DEST}")
        return
    print(f"Downloading {URL} -> {DEST}")
    urllib.request.urlretrieve(URL, DEST)
    print("Done.")


if __name__ == "__main__":
    main()
