from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import memo as memo_module
from .schemas import (
    LoanDetail,
    MemoResponse,
    NewLoanRequest,
    RescoreResponse,
    ScoreResponse,
    SummaryResponse,
    WatchlistResponse,
    WhatIfRequest,
    WhatIfResponse,
)
from .scoring import ScoringService

app = FastAPI(title="PrakashPD API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

service = ScoringService()


@app.get("/api/health")
def health():
    return {"status": "ok", "last_scored_at": service.last_scored_at}


@app.get("/api/summary", response_model=SummaryResponse)
def summary():
    return service.summary()


@app.get("/api/watchlist", response_model=WatchlistResponse)
def watchlist(
    segment: str | None = None,
    band: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    items, total = service.watchlist(segment, band, limit, offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@app.get("/api/loans/{borrower_id}", response_model=LoanDetail)
def loan_detail(borrower_id: int):
    detail = service.loan_detail(borrower_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="borrower_id not found")
    return detail


@app.post("/api/score", response_model=ScoreResponse)
def score_new_loan(req: NewLoanRequest):
    """Live scoring for a hypothetical/new borrower — runs the real trained
    pipeline on the spot. See README for which fields are real trained
    features vs context-only (tenure_months, annual_income)."""
    return service.score_new_loan(req)


@app.post("/api/loans/{borrower_id}/what-if", response_model=WhatIfResponse)
def what_if(borrower_id: int, req: WhatIfRequest):
    result = service.what_if(borrower_id, req)
    if result is None:
        raise HTTPException(status_code=404, detail="borrower_id not found")
    return result


@app.post("/api/loans/{borrower_id}/memo", response_model=MemoResponse)
def generate_memo(borrower_id: int):
    detail = service.loan_detail(borrower_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="borrower_id not found")
    memo = memo_module.build_memo(
        borrower_id=detail["borrower_id"],
        segment=detail["segment"],
        exposure=detail["exposure_at_risk"],
        pd_score=detail["pd_score"],
        band=detail["band"],
        reasons=detail["reason_codes"],
    )
    memo_module.render_pdf(memo)
    memo["pdf_url"] = f"/api/memos/{memo['memo_id']}.pdf"
    return memo


@app.get("/api/memos/{memo_id}.pdf")
def download_memo(memo_id: str):
    path = memo_module.MEMO_DIR / f"{memo_id}.pdf"
    if not path.exists():
        raise HTTPException(status_code=404, detail="memo not found")
    return FileResponse(path, media_type="application/pdf", filename=f"prakashpd_memo_{memo_id}.pdf")


@app.post("/api/rescore", response_model=RescoreResponse)
def rescore():
    return service.rescore()
