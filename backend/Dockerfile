FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY prisma ./prisma
COPY data ./data
COPY src ./src

RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 8080

CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.js && node src/index.js"]
