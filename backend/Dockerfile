FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma

RUN npm install

COPY data ./data
COPY src ./src
COPY scripts/start.sh ./scripts/start.sh
RUN chmod +x ./scripts/start.sh && mkdir -p uploads

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["./scripts/start.sh"]
