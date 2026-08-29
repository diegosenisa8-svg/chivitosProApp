# syntax=docker/dockerfile:1
# Front (servicio web en Railway — Root Directory = /)
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

    COPY index.html ./
    COPY vite.config.ts tsconfig*.json ./
    COPY public ./public
    COPY src ./src

    # Misma origen en prod (proxy runtime). No hace falta VITE_API_URL en build.
    ENV VITE_API_URL=
    RUN npm run build

    FROM node:22-alpine

    WORKDIR /app

    ENV NODE_ENV=production
    ENV PORT=3000

    COPY package.json package-lock.json ./
    RUN --mount=type=cache,target=/root/.npm \
        npm ci --omit=dev

        COPY server.mjs ./
        COPY --from=build /app/dist ./dist

        EXPOSE 3000

        CMD ["node", "server.mjs"]
