# Specify the base image
FROM node:21.6.1

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose the port the app runs on
EXPOSE 3001

# Command to run your app
CMD ["node", "submit-server.js"]
