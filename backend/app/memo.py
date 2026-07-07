"""
Action memo generation: a structured, template-based summary (no LLM call —
everything is deterministic string formatting over real computed values, so
it needs no API key and is reproducible) plus a downloadable PDF via reportlab.
"""
from __future__ import annotations

import re
import time
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

MEMO_DIR = Path(__file__).resolve().parents[1] / "memos"
MEMO_DIR.mkdir(exist_ok=True)

INTERVENTIONS = {
    "High": "Escalate to credit committee for review; place on close watch; consider limit freeze pending RM follow-up.",
    "Elevated": "RM to conduct a check-in call within 2 weeks; monitor closely through the next billing cycle.",
    "Watch": "Include in standard quarterly monitoring; no immediate action required.",
}


def _lower_first(s: str) -> str:
    return s[0].lower() + s[1:] if s else s


def build_summary(borrower_id: int, segment: str, exposure: float, pd_score: float, band: str, reasons: list[str]) -> str:
    top_reasons = "; ".join(_lower_first(r.rstrip(".")) for r in reasons[:2])
    return (
        f"Borrower {borrower_id} ({segment} segment, exposure at risk Rs {exposure:,.0f}) is "
        f"currently scored {pd_score:.0f}/100, placing the account in the {band} band. "
        f"This is primarily driven by: {top_reasons}. {INTERVENTIONS[band]}"
    )


def build_memo(borrower_id: int, segment: str, exposure: float, pd_score: float, band: str, reasons: list[str]) -> dict:
    summary = build_summary(borrower_id, segment, exposure, pd_score, band, reasons)
    memo_id = f"{borrower_id}_{int(time.time())}"
    return {
        "memo_id": memo_id,
        "borrower_id": borrower_id,
        "segment": segment,
        "exposure_at_risk": exposure,
        "pd_score": pd_score,
        "band": band,
        "reason_codes": reasons,
        "recommended_intervention": INTERVENTIONS[band],
        "summary": summary,
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    }


_ILLEGAL_XML = re.compile(r"[&<>]")


def _escape(text: str) -> str:
    return _ILLEGAL_XML.sub(lambda m: {"&": "&amp;", "<": "&lt;", ">": "&gt;"}[m.group()], text)


def render_pdf(memo: dict) -> Path:
    path = MEMO_DIR / f"{memo['memo_id']}.pdf"
    doc = SimpleDocTemplate(str(path), pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "MemoTitle", parent=styles["Title"], textColor=colors.HexColor("#12281f"), fontSize=18
    )
    heading_style = ParagraphStyle(
        "MemoHeading", parent=styles["Heading2"], textColor=colors.HexColor("#c05a1f"), spaceBefore=12
    )
    body_style = styles["BodyText"]

    story = [
        Paragraph("PrakashPD — Credit Risk Action Memo", title_style),
        Spacer(1, 8),
        Paragraph(f"Generated: {memo['generated_at']}", body_style),
        Spacer(1, 12),
        Paragraph("Loan Identification", heading_style),
        Table(
            [
                ["Borrower ID", str(memo["borrower_id"])],
                ["Segment", memo["segment"]],
                ["Exposure at Risk", f"Rs {memo['exposure_at_risk']:,.0f}"],
                ["PD Score", f"{memo['pd_score']:.1f} / 100"],
                ["Risk Band", memo["band"]],
            ],
            colWidths=[140, 300],
            style=TableStyle([
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#8a8a8a")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#eef2ee")),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]),
        ),
        Spacer(1, 12),
        Paragraph("Top Reason Codes", heading_style),
    ]
    for r in memo["reason_codes"]:
        story.append(Paragraph(f"&bull; {_escape(r)}", body_style))
    story.append(Spacer(1, 12))
    story.append(Paragraph("Recommended Intervention", heading_style))
    story.append(Paragraph(_escape(memo["recommended_intervention"]), body_style))
    story.append(Spacer(1, 12))
    story.append(Paragraph("Summary for Credit Committee", heading_style))
    story.append(Paragraph(_escape(memo["summary"]), body_style))

    doc.build(story)
    return path
