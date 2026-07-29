# Front (servicio web en Railway — Root Directory = /)
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html ./
COPY vite.config.ts tsconfig*.json ./
COPY public ./public
COPY src ./src

# VITE_* viene de las variables del servicio en Railway (build-time)
RUN npm run build

FROM node:22-alpine

WORKDIR /app

RUN npm install -g serve@14.2.5

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT}"]
