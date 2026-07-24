# Blink headless agent server (OpenHands-style HTTP API)
# Build: docker build -t blink-agent .
# Run:   docker run --rm -p 9477:9477 -e BLINK_API_KEY=... blink-agent

FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json package-lock.json ./
RUN bun install --frozen-lockfile

COPY . .

ENV NODE_ENV=production
ENV BLINK_FORCE_INTERACTIVE=0
ENV CLAUDE_STREAM_IDLE_TIMEOUT_MS=300000

EXPOSE 9477

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:9477/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "run", "entrypoints/agent-server.ts"]