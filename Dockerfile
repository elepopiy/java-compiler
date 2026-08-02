FROM node:20-alpine

# Java Compiler (javac) ve Java Runtime'ı (java) yüklüyoruz
RUN apk add --no-gradable --no-cache openjdk17-jdk

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Klasör sahipliğini node kullanıcısına ver
RUN chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "index.js"]