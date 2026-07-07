# PrakashPD: Default Prediction Model

Prototype for IDBI Innovate 2026, PS4: Default Prediction Model.

It predicts loan stress ahead of time on a single calibrated 0-100 scale, fusing
structured credit-bureau-style features with a simulated unstructured signal
(RM notes). SHAP gives plain-language reason codes a credit officer can act
on, a what-if simulator lets them test restructuring terms, and a one-click
action memo generator (JSON and PDF) turns the score into something an
officer can actually act on, not just read.

## Architecture

The two diagrams below show the target, pitch-level architecture this
prototype is scoped down from. **They depict the full intended vision, not
everything in this repo.** The callouts under each explain what's actually
implemented here versus what's illustrative for the pitch.

![Data sources through processing to delivery & governance pipeline](docs/architecture-pipeline.png)

*This prototype implements stages 1 through 4 of the pipeline above (feature
store, NLP head, survival plus GBM ensemble, calibrated PD scale), along with
the reason-code and action engine and the watchlist API/dashboard on the
delivery side. It does **not** implement live CIBIL, GST, UPI, or Account
Aggregator data feeds, an RBI-aligned governance layer, or production
monitoring and alerting. Those are represented by synthetic data and a local
FastAPI service instead (see "What is real vs. what is simulated" below).*

![Core application backend and risk dashboard stack](docs/architecture-stack.jpg)

*This prototype's actual stack is narrower than shown. It's Python 3.11 with
FastAPI and pandas (no Polars), scikit-learn/LightGBM/lifelines (no Optuna
tuning, no scikit-survival), a small pretrained sentence-transformer
(all-MiniLM-L6-v2) for the text signal (no DistilBERT or spaCy, no
fine-tuning), and React with TypeScript and Vite for the frontend (no
Recharts; the PD gauge is a custom bar component per the brief's "no
circular dial" requirement). There is no CIBIL bureau integration,
PostgreSQL, DuckDB, Docker, or CI pipeline in this prototype. Data lives in
CSV/artifact files on disk, which is fine for a laptop-run hackathon demo
but is exactly the kind of thing a production build-out would add.*

## What is real vs. what is simulated

This is stated once here rather than repeated in every file. See the notebook
(`notebooks/01_eda_feature_engineering.ipynb`) for the exact point each
simulated field gets introduced.

**Real:**
- The structured dataset: [UCI "Default of Credit Card Clients"](https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients),
  30,000 real Taiwanese credit card accounts, April to September 2005, with
  the label being default in October 2005. We chose this over Home Credit,
  Lending Club, or "Give Me Some Credit" because those require a Kaggle
  account and an API token. This dataset is a direct, unauthenticated
  download, so the whole pipeline runs on a laptop with zero credentials.
- All EDA statistics and every feature engineered from the source columns
  (utilization ratios, payment ratios, delinquency counts and trend).
- The LightGBM classifier, the Cox PH survival model, the isotonic
  calibration, the sentence-transformer plus PCA NLP fusion, and the SHAP
  explainer are all genuinely trained and fitted, not stubbed.
- All reported metrics (AUC, Gini, KS, recall@20%) are computed on a held-out
  split, not fabricated.
- Every number the frontend displays comes from a live call to the FastAPI
  backend, which runs the saved model artifacts at request time. Nothing in
  the UI is a hardcoded mock. This includes the "score a new loan" form and
  the what-if simulator: both call `model/inference.py`, the same generic
  scoring engine used for the watchlist, so a live score is a real re-run of
  the trained GBM, Cox, and isotonic pipeline, never a lookup or a linear
  approximation.

**Simulated (and why):**
- **RM notes and narratives.** The source data has no free text at all, so
  we generate template-based English notes whose sentiment is correlated
  with each borrower's *real* delinquency trend (not random), so the NLP
  fusion step has genuine signal to find rather than a decorative feature
  that does nothing. The notes are embedded with a pretrained
  sentence-transformer rather than TF-IDF, so novel phrasing is recognized
  by meaning rather than exact vocabulary match, though generalization is
  still bounded by the size of this synthetic note corpus.
- **`segment` and `exposure_at_risk`.** The source dataset is single
  product (credit cards only), not a multi-segment loan book. We assign a
  synthetic segment label (skewed by real `LIMIT_BAL`) to demo the "one
  scale across segments" story from the brief. `exposure_at_risk` is
  derived from the real `LIMIT_BAL` and utilization fields, but the segment
  taxonomy itself is invented.
- **Survival `duration` and `event`.** The source label is a single
  one-month-ahead binary flag; there is no observed multi-month
  time-to-default. We derive a duration proxy from the real repayment
  status trend (the event is the first month delinquency appears,
  censored at 6 months for non-defaulters) to demonstrate the
  survival-analysis *technique* the brief asks for. Treat the resulting
  "12-month horizon" framing as illustrative, not a validated forward
  time-to-default estimate.
- **`loan_vintage_month` and the out-of-time split.** The source data has
  no date field whatsoever. We assign a synthetic vintage month and split
  on it (months 1 through 9 train, 10 through 12 test) to demonstrate a
  *time-based* validation methodology rather than a random split, which
  would overstate performance on a rare-event target. The metrics below
  come from that split, but it isn't a real chronological backtest since
  there's no true time ordering in the underlying rows.

## Why not "accuracy"

The target is a roughly 22% base-rate rare event. A model that predicts "no
default" for every borrower scores about 78% accuracy while catching zero
defaulters, so accuracy is actively misleading here. We report AUC, Gini
(`2*AUC - 1`), the KS statistic (the max separation between the cumulative
good and bad distributions), and recall at the top 20% of the score
distribution (how many actual defaulters you'd catch if you only acted on
the riskiest fifth of the book) instead.

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
models (around 0.77 to 0.78 AUC), so nothing here is inflated.

## The what-if simulator: real feature vs. translation layer

The brief asks that if a what-if lever "cannot plausibly be computed from the
model's input features," we say so rather than fake it. Here's the exact
breakdown:

- **Backed directly by trained features:** outstanding balance and
  principal (which maps to `BILL_AMT1..6`, feeding `avg_util_ratio`) and
  repayment status history (`PAY_1..6`).
- **Backed by a disclosed translation layer, not a raw trained feature:**
  interest rate and tenure. This model is trained on revolving credit card
  repayment history, so there's no "interest rate" or "tenure" column in
  the training data at all (those are term-loan concepts). To make these
  levers do something real instead of skipping them, `model/inference.py`'s
  `compute_emi` runs rate and tenure through the **standard reducing
  balance EMI formula** (real, deterministic finance math) to derive a
  monthly payment, which then feeds into the real trained `avg_pay_ratio`
  feature across the whole 6-cycle window. A restructure is a going-forward
  change, so it's applied to all 6 cycles rather than just the most recent
  one. (Applying it to only one cycle was an early bug here: it diluted
  the effect roughly one in six and the what-if barely moved the score. It
  was fixed by applying the new terms across the full window.) The GBM,
  Cox, and isotonic pipeline is then genuinely re-run on this modified
  feature vector. Only the rate/tenure to payment translation is a
  disclosed modeling choice, not literal training data.
- **What you'll observe:** the simulator can move a score up as well as
  down. If the EMI implied by a proposed rate and tenure is lower than what
  the borrower already pays, the model correctly reads that as a weaker
  repayment commitment and risk rises. That's intentional, and it's proof
  this is a real model re-run rather than a "sliders always help" gimmick.

## "Score a new loan": real vs. context-only fields

- **Real, trained features:** loan amount or credit limit, age, a 6-cycle
  repayment history pattern selector, credit utilization percent,
  existing or expected EMI, segment, and the free-text RM note.
- **Context only, never fed to the model:** `tenure_months` and
  `annual_income`. Neither is a trained feature (see above). The form
  still collects them because an officer would want them on the memo, but
  the API and UI say explicitly that they don't affect the score rather
  than silently ignoring them.
- **A deeper limitation worth naming:** the model's strongest signals are
  repayment *history* features that a genuinely first-time applicant
  wouldn't have yet. This is really a "behavior scorecard" that scores an
  existing or renewing relationship, rather than an "application
  scorecard" for a brand-new customer. It's the same distinction real bank
  risk stacks draw. "Score a new loan" is best read as scoring a proposed
  facility where the officer supplies an initial track record, or accepts
  a neutral "clean" default.

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
needs internet once to fetch the sentence-transformer weights, which are
cached locally after that.

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
- `POST /api/score`: live scoring for a hypothetical new loan (see honesty note above)
- `POST /api/loans/{borrower_id}/what-if`: recompute PD under modified rate, tenure, principal, or EMI
- `POST /api/loans/{borrower_id}/memo`: generate a structured action memo (JSON, also renders a PDF)
- `GET /api/memos/{memo_id}.pdf`: download the generated memo PDF
- `POST /api/rescore`: recomputes every score in the book live (the "overnight batch" trigger)

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the printed localhost URL. `frontend/.env` points at
`http://127.0.0.1:8000` by default. There are five views: the watchlist, a
per-loan score detail page (bar-style PD gauge, reason codes, recommended
action), a "score a new loan" form (with one-click high-risk/low-risk
example buttons), a what-if panel, and a "generate memo" button on the
score detail page.

## Modelling approach

1. **LightGBM** classifier on structured features (repayment history,
   utilization/payment ratios, delinquency trend) plus 16 sentence-transformer
   (all-MiniLM-L6-v2) to PCA components from the RM notes.
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
   top driver, the reason code quotes the actual note text rather than
   describing an uninterpretable embedding component.
5. **`model/inference.py`** is a single generic scoring engine, not a
   borrower-ID lookup, used by every caller: batch watchlist scoring, live
   "score a new loan," and the what-if simulator. It re-derives the same
   engineered features used at training time from a raw feature dict, so a
   live score is computed identically to how the historical book was
   scored. Train-set and test-set scores are rank-normalized against the
   same fixed *training* reference distribution (`np.searchsorted` against
   a saved sorted array) rather than each split's own distribution. This
   was a bug caught during development: the original evaluation ranked the
   test split against itself, which a deployed model could never do at
   serving time, and it didn't match how `score_full_book` scores in
   production. Fixing it changed the reported AUC by less than 0.001, so it
   wasn't inflating results, but it was methodologically wrong and is now
   fixed in `model/train.py`.
6. **Action memo** (`backend/app/memo.py`): a deterministic, template-based
   plain-language summary (no LLM call, so no API key is needed and it's
   fully reproducible) plus a PDF rendered with reportlab.

## Known limitations

- The survival and OOT-split components rely on simulated time structure
  (see above) because the source dataset has none, so the "12-month
  horizon" framing is a technique demonstration, not a certified estimate.
- The Cox model horizon is capped at the observed 6-cycle window in the
  data and doesn't extrapolate to a true calendar year.
- No hyperparameter tuning was performed beyond reasonable defaults, so
  there's headroom in AUC with tuning, feature selection, and a real
  multi-loan-type dataset.
- Demographic fields (`SEX`, `EDUCATION`, `MARRIAGE`) are included as raw
  UCI columns for this prototype. A production deployment would need a
  fair-lending review before using any demographic feature in a credit
  decision.
- The what-if simulator's rate and tenure levers go through a disclosed
  EMI-formula translation layer, not literal trained features (see above).
  It's a real recomputation through the trained model, but rate and tenure
  aren't columns the model was trained on directly.
- "Score a new loan" scores a proposed facility assuming an initial track
  record. It doesn't model a true zero-history first-time applicant, since
  the trained model's strongest signals are repayment-history features
  (see above).
- The memo's plain-language summary is deterministic template text, not an
  LLM-generated narrative. That's by design, so it needs no API key and is
  reproducible, but it reads more mechanically than a human-written memo.
