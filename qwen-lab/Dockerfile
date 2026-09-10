FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV PORT=3010
ENV HOSTNAME=0.0.0.0
EXPOSE 3010
CMD ["npm", "start"]
