FROM node:20-slim AS frontend-build

WORKDIR /build
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY api/ api/
COPY core/ core/
COPY db/ db/
COPY templates/ templates/

COPY --from=frontend-build /build/dist /app/static

ENV DB_PATH=/app/data/langgraph_builder.db
VOLUME /app/data

EXPOSE 5000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]
