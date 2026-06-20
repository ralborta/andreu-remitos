FROM node:20-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend --omit=dev

COPY lib ./lib
COPY backend ./backend

WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV UPLOAD_DIR=/app/backend/uploads
ENV DATA_DIR=/app/backend/data

EXPOSE 3001

CMD ["node", "src/server.mjs"]
