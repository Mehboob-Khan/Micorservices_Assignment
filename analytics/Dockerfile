FROM node:21.6.1

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

EXPOSE 3300
CMD [ "node", "analytics-server.js" ]
