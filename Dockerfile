FROM node:20-alpine

# Java Compiler (javac) ve Java Runtime'ı (java) yüklüyoruz
# build-base: npm/node-gyp için native derleyici (gcc/g++/make) — native paket kurulumları için gerekli
# mingw-w64-gcc: C/C++ kaynak kodlarını Windows'ta çalışabilen .exe dosyalarına ÇAPRAZ DERLEMEK için
#   -> x86_64-w64-mingw32-gcc  (C)
#   -> x86_64-w64-mingw32-g++  (C++)
RUN apk add --no-cache openjdk17-jdk build-base mingw-w64-gcc

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