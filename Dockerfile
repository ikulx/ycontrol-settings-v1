# Verwenden Sie ein offizielles Node.js-Image als Basis
FROM node:14

# Festlegen des Arbeitsverzeichnisses im Container
WORKDIR /app

# Kopieren von package.json und package-lock.json in das Arbeitsverzeichnis
COPY package*.json ./

# Installieren der Abhängigkeiten
RUN npm install

# Kopieren des restlichen Quellcodes
COPY . .

# Festlegen des Ports, der vom Container verwendet wird
EXPOSE 3000

# Starten der Anwendung
CMD ["npm", "start"]
