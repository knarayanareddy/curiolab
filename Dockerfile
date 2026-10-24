FROM node:22.22.0-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-17-jre-headless ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build:browser-engine && ./scripts/kotlin.sh build
ENV NODE_ENV=development
CMD ["pnpm", "exec", "tsx", "scripts/firetv-simulator.ts"]
