FROM node:10

ENV NODE_ENV=production
WORKDIR /usr/src/EtherScamDB

COPY package*.json ./
RUN npm install --only=production
COPY . .
EXPOSE 80

CMD ["npm", "start"]