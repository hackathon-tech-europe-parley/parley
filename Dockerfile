FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN npm install --frozen-lockfile

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG OPENAI_API_KEY=placeholder
ARG LLM_PROVIDER=openai
ARG LLM_MODEL=gpt-4o
ARG FAL_KEY=placeholder
ARG FAL_IMAGE_MODEL=fal-ai/flux/schnell
ARG GRADIUM_API_KEY=placeholder

ENV OPENAI_API_KEY=$OPENAI_API_KEY
ENV LLM_PROVIDER=$LLM_PROVIDER
ENV LLM_MODEL=$LLM_MODEL
ENV FAL_KEY=$FAL_KEY
ENV FAL_IMAGE_MODEL=$FAL_IMAGE_MODEL
ENV GRADIUM_API_KEY=$GRADIUM_API_KEY

RUN npm run build

# Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1
CMD ["node", "server.js"]
