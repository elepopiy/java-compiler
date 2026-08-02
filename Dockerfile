# 1. Aşama: Build (Derleme)
FROM node:20-alpine AS builder

WORKDIR /app

# Bağımlılıkları yükle
COPY package*.json ./
RUN npm ci

# Kaynak kodları kopyala ve projeyi derle
COPY . .
RUN npm run build

# 2. Aşama: Runner (Üretim Çalıştırma Ortamı)
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Sadece üretim bağımlılıklarını yükle
COPY package*.json ./
RUN npm ci --only=production

# Derleme çıktısını derleme aşamasından kopyala
COPY --from=builder /app/dist ./dist

# Güvenlik için non-root kullanıcıya geç
USER node

EXPOSE 3000

CMD ["node", "dist/index.js"]