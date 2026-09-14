# SCMpro 엔진 — Railway Cron 서비스용 (D-049). `engine tick` 을 10분마다 실행
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*   # lightgbm 런타임
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY scm_engine ./scm_engine
RUN uv sync --frozen --no-dev
CMD ["uv", "run", "--no-sync", "engine", "tick"]
