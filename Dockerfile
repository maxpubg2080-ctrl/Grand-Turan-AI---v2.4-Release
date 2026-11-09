# Grand Turan AI — Production Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency definitions and npm configuration
COPY package.json package-lock.json* .npmrc* ./
RUN npm install --legacy-peer-deps

# Copy full source and build frontend bundle
COPY . .
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies
COPY package.json package-lock.json* .npmrc* ./
RUN npm install --legacy-peer-deps

# Copy built assets and backend
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/vite.config.ts ./vite.config.ts

EXPOSE 3000

CMD ["npm", "start"]
