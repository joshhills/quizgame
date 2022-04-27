FROM node:alpine

WORKDIR /apps
RUN npm install ws node-static
ADD . /apps/

EXPOSE 3000

ENTRYPOINT ["node", "server.js"]