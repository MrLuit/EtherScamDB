FROM node:10

ENV NODE_END=production
WORKDIR /usr/src/EtherScamDB

COPY package*.json ./
RUN npm install --only=production
COPY . .
EXPOSE 80
EXPOSE 5111

CMD ["npm", "start:prod"]