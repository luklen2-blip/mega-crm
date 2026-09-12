FROM node:20-alpine
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev || true

COPY . .

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

# Validação obrigatória de integridade antes do empacotamento da imagem
RUN node tests/run_all.js

CMD ["node", "server.js"]
