FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Bağımlılıkları kopyala ve yükle
COPY package*.json ./
RUN npm install --omit=dev

# Tüm proje dosyalarını kopyala
COPY . .

# Güvenlik için non-root kullanıcı
USER node

EXPOSE 3000

# Ana dosyan hangisiyse (örn: index.js veya app.js veya src/index.js)
CMD ["node", "index.js"]