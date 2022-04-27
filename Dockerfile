FROM node:alpine

WORKDIR /apps
ADD . /apps/
RUN npm install

EXPOSE 3000

ENTRYPOINT ["node", "server.js"]