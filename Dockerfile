FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Klasör sahipliğini node kullanıcısına ver
RUN chown -R node:node /app

# Güvenlik için kısıtlı kullanıcıya geç
USER node

EXPOSE 3000

CMD ["node", "index.js"]