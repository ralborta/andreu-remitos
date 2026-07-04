FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
RUN mkdir -p assets/inbound

ENV NODE_ENV=production
ENV PORT=3008
ENV MEDIA_DIR=/app/assets/inbound
ENV BOT_DB_PATH=data/db.json

EXPOSE 3008

CMD ["node", "src/app.js"]
