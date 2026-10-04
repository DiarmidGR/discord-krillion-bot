FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache \
    python3 \
    make \
    g++

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build


FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

RUN mkdir -p /app/data

CMD ["node", "dist/index.js"]