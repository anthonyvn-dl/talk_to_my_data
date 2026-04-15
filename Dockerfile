FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
ARG GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY
# Build le front Vite
RUN npm run build

EXPOSE 8080
ENV NODE_ENV=production
# Utilise tsx comme en dev (déjà dans tes devDependencies)
CMD ["npx", "tsx", "server.ts"]
