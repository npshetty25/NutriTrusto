# Build from the repository root:
#   docker build -f ml/service/Dockerfile -t nutri-trust-ml .
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv

COPY ml/service/requirements.txt ml/service/requirements.txt
RUN pip install --no-cache-dir -r ml/service/requirements.txt

COPY ml/__init__.py ml/__init__.py
COPY ml/service ml/service
COPY ml/artifacts/category-v1.joblib ml/artifacts/category-v1.joblib

RUN useradd --system --no-create-home app
USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2).status == 200 else 1)"

CMD ["uvicorn", "ml.service.app:app", "--host", "0.0.0.0", "--port", "8000"]
