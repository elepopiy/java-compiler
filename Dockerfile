FROM node:20-alpine

# Java Compiler (javac) ve Java Runtime'ı (java) yüklüyoruz
# build-base: gcc, g++, make, libc-dev — C ve C++ derleyicileri için gerekli
RUN apk add --no-cache openjdk17-jdk build-base

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