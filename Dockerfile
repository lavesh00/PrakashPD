# Serves the PrakashPD FastAPI backend. Built to run on Hugging Face Spaces
# (Docker SDK, listens on port 7860) but works on any container host.
FROM python:3.11-slim

# LightGBM's shared library needs libgomp at runtime; python:slim doesn't
# include it by default.
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 appuser
ENV HOME=/home/appuser \
    PATH=/home/appuser/.local/bin:$PATH \
    HF_HOME=/home/appuser/.cache/huggingface \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY --chown=appuser backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /app/backend/requirements.txt

COPY --chown=appuser model/ /app/model/
COPY --chown=appuser backend/ /app/backend/

USER appuser
WORKDIR /app/backend

EXPOSE 7860

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
