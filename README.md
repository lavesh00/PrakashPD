# PrakashPD: Default Prediction Model

Built for IDBI Innovate 2026, PS4: Default Prediction Model.

PrakashPD predicts loan stress ahead of time on a single calibrated 0-100
scale, fusing structured repayment history with an unstructured RM-note
signal. SHAP turns that into plain-language reason codes a credit officer
can act on. A what-if simulator lets an officer test restructuring terms
before offering them, and a one-click action memo generator produces the
actual document a credit committee would file, both JSON and PDF.

## Architecture

![Data sources through processing to delivery & governance pipeline](docs/architecture-pipeline.png)

The pipeline: a feature store built from real repayment data, an NLP head
that embeds RM notes with a pretrained sentence-transformer, a survival
model and a gradient-boosted ensemble feeding a single calibrated PD scale,
a SHAP-based reason-code and action engine, and a live watchlist API and
dashboard on the delivery side.

![Core application backend and risk dashboard stack](docs/architecture-stack.jpg)

The stack: Python 3.11, FastAPI, and pandas on the backend; scikit-learn,
LightGBM, and lifelines for the models; a pretrained sentence-transformer
(all-MiniLM-L6-v2) for the text signal; React, TypeScript, and Vite for the
frontend, with a custom bar-and-ring PD gauge built to spec rather than a
generic chart library.

## What it does

- **Single calibrated PD score, 0-100, across segments.** LightGBM and a
  Cox Proportional Hazards survival model are blended and isotonic-calibrated
  into one scale, so a Retail Personal loan and an SME loan are directly
  comparable instead of using different scorecards per product.
- **Real out-of-time metrics**, not a random validation split (see below).
- **Plain-language reason codes**, generated from real SHAP values on the
  trained model, quoting the borrower's actual RM note when the text signal
  is a top driver rather than describing an opaque embedding component.
- **A live watchlist, score-detail, and "score a new loan" form** that call
  the trained model in real time. Nothing in the UI is a static mock.
- **A what-if simulator** that genuinely re-runs the trained pipeline under
  modified loan terms, so an officer can see whether a restructure would
  actually move a loan out of its risk band before offering it.
- **One-click action memos**, JSON and downloadable PDF, generated from the
  live score, reason codes, and recommended action.
- **A portfolio stress test** that re-runs the trained pipeline across the
  entire 30,000-loan book under a utilization or delinquency shock, showing
  how exposure would redistribute across bands.
- **A model performance page and a settings page** showing the real trained
  metrics, feature importances, and model configuration live from the API.

## Real metrics achieved (out-of-time holdout, n=7,566)

| Metric | Value |
|---|---|
| AUC | 0.779 |
| Gini | 0.558 |
| KS statistic | 0.429 |
| Recall @ top 20% | 51.5% |
| Test default rate | 22.0% |
| Band split (test) | Watch 63.7% / Elevated 25.6% / High 10.7% |

These line up with published benchmarks on this dataset for gradient-boosted
models. We report AUC, Gini, KS, and recall@20% instead of accuracy because
the target is a ~22% base-rate rare event, and those four metrics are what
actually tell you whether a model separates good borrowers from bad ones.

## Data and methodology

The structured model trains on the [UCI "Default of Credit Card Clients"](https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients)
dataset: 30,000 real Taiwanese credit card accounts, April to September
2005, with the label being default in October 2005. It's a direct,
unauthenticated download, so the whole pipeline runs on a laptop with zero
credentials or paid API keys.

To demonstrate the full brief, mostly a single-product credit-bureau
dataset, we layered in a few realistic constructions on top of it:

- **RM notes**, generated from templates whose sentiment tracks each
  borrower's real delinquency trend, then embedded with a pretrained
  sentence-transformer so the NLP fusion step reads meaning rather than
  exact vocabulary. This is what powers the reason codes that quote the
  actual note text, and the "score a new loan" free-text field.
- **Segment and exposure-at-risk labels**, so the single calibrated scale
  can be demonstrated the way a real multi-product loan book would use it.
- **A survival duration signal**, derived from each borrower's real
  repayment-status trend, feeding the Cox Proportional Hazards model that
  gives the system its forward-looking horizon.
- **A time-based train/test split**, so the reported metrics come from an
  out-of-time evaluation methodology rather than a random split that would
  overstate performance on a rare-event target.

The full construction of each is documented step by step in
`notebooks/01_eda_feature_engineering.ipynb`, reproducible top to bottom.

## The what-if simulator

Outstanding balance and repayment status history are real trained features,
so a principal change or a delinquency change runs straight through the
model. Interest rate and tenure are translated into a monthly payment via
the standard reducing-balance EMI formula, applied across the loan's full
repayment window as a going-forward restructure, and that payment then
drives the real trained payment-ratio feature. The GBM, Cox, and isotonic
pipeline is genuinely re-run on the result, so the simulator can move a
score up or down depending on whether the proposed terms are actually
stronger than what the borrower already pays, exactly what a real
restructuring decision needs to show.

## Scoring a new loan

Loan amount, age, repayment-history pattern, credit utilization, EMI,
segment, and the RM note all map directly onto trained features, so
submitting the form runs the real model live. Tenure and income are
collected for the memo and for officer context, since they matter to a
credit decision even though this particular training set doesn't carry a
tenure or income column.

## Repo structure

```
data/               download_data.py (no raw data committed)
notebooks/          01_eda_feature_engineering.ipynb, reproducible top to bottom
model/              train.py, explain.py, inference.py, artifacts/ (saved model + metrics report)
backend/            FastAPI service: watchlist, live scoring, what-if, memo generation (+ PDF template)
frontend/           React + TypeScript (Vite) risk console
```

## Setup and run

Requires Python 3.11+ and Node 18+.

### 1. Data + model training

```bash
cd model
pip install -r requirements.txt
pip install jupyter nbclient  # only needed to re-run the notebook
python ../data/download_data.py
jupyter nbconvert --to notebook --execute --inplace ../notebooks/01_eda_feature_engineering.ipynb
python train.py
```

This writes `model/artifacts/` (LightGBM model, Cox model, NLP PCA,
isotonic calibrator, config, metrics report, scored book). The first run
fetches the sentence-transformer weights once; they're cached locally after.

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000
```

Endpoints:
- `GET /api/summary`: book-level KPIs (total exposure, band counts)
- `GET /api/watchlist?segment=&band=&limit=&offset=`: ranked by exposure at risk
- `GET /api/loans/{borrower_id}`: PD, band, SHAP reason codes, recommended action
- `POST /api/score`: live scoring for a hypothetical new loan
- `POST /api/loans/{borrower_id}/what-if`: recompute PD under modified rate, tenure, principal, or EMI
- `POST /api/loans/{borrower_id}/memo`: generate a structured action memo (JSON, also renders a PDF)
- `GET /api/memos/{memo_id}.pdf`: download the generated memo PDF
- `POST /api/rescore`: recomputes every score in the book live (the "overnight batch" trigger)
- `GET /api/model-performance`: real trained metrics and feature importances
- `POST /api/portfolio-stress-test`: re-scores the whole book under a stress scenario
- `GET /api/settings`: live model configuration

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the printed localhost URL. `frontend/.env` points at
`http://127.0.0.1:8000` by default. Six views: the watchlist, a per-loan
score detail page (bar-and-ring PD gauge, reason codes, recommended action,
what-if panel, memo generator), a "score a new loan" form with one-click
high-risk/low-risk example buttons, model performance, portfolio stress
test, and settings.

## Modelling approach

1. **LightGBM** classifier on structured features (repayment history,
   utilization/payment ratios, delinquency trend) plus 16 sentence-transformer
   (all-MiniLM-L6-v2) → PCA components from the RM notes.
2. **Cox Proportional Hazards** (lifelines) on the same borrowers, giving a
   horizon-based hazard estimate instead of a single snapshot probability.
3. Both outputs are rank-normalized, blended (0.7 GBM / 0.3 Cox), and passed
   through an **isotonic regression** fit on the train split to produce one
   calibrated 0-100 score, banded into Watch, Elevated, and High at the 70th
   and 90th percentile.
4. **SHAP** (`TreeExplainer`) on the LightGBM model generates the top 3 to 4
   feature contributions per loan, translated into plain-language reason
   codes (for example, "3 of the last 6 billing cycles were delinquent"
   rather than a raw feature name). When an RM-note-derived feature is a
   top driver, the reason code quotes the actual note text.
5. **`model/inference.py`** is a single generic scoring engine, not a
   borrower-ID lookup, used by every caller: batch watchlist scoring, live
   "score a new loan," the what-if simulator, and the portfolio stress test.
   It re-derives the same engineered features used at training time from a
   raw feature dict, so every live score is computed exactly the way the
   historical book was scored, and every score (train, test, or live) is
   rank-normalized against the same fixed training reference distribution.
6. **Action memo** (`backend/app/memo.py`): a deterministic, template-based
   plain-language summary, no LLM call needed, plus a PDF rendered with
   reportlab.

## What's next

- Tune hyperparameters and expand the feature set on a larger, multi-product
  loan book for further AUC headroom.
- Extend the survival component to a full calendar-year horizon as
  multi-period repayment data becomes available.
- Layer in a fair-lending review before any demographic feature reaches a
  live credit decision.
