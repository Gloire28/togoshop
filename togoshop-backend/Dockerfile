# --- Togoshop Backend Dockerfile ---

FROM node:20-alpine

# bcrypt nécessite une compilation native (python3, make, g++)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copier uniquement les fichiers de dépendances d'abord (meilleur cache Docker)
COPY package*.json ./

RUN npm ci --omit=dev

# Copier le reste du code
COPY . .

EXPOSE 5000

CMD ["npm", "start"]
