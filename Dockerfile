# Gebruik een officiële Node.js runtime als base image
FROM node:20-alpine

# Stel de werkdirectory in de container in
WORKDIR /app

# Kopieer package.json en package-lock.json (als aanwezig)
COPY package*.json ./

# Installeer dependencies
RUN npm install

# Kopieer de rest van de app
COPY . .

# Expose poort (meestal 3000 voor Express)
EXPOSE 3000

# Start de app
CMD ["node", "server.js"]
