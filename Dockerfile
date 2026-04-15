FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build le front Vite
RUN npm run build

EXPOSE 8080
ENV NODE_ENV=production
# Utilise tsx comme en dev (déjà dans tes devDependencies)
CMD ["npx", "tsx", "server.ts"]
