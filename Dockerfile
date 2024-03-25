# Use Node.js LTS version as the base image
FROM node:16.18.0-alpine3.16

# Set working directory
WORKDIR /app

# Copy package.json and yarn.lock files to the working directory
COPY package.json yarn.lock /app/
# COPY package.json /app/

# Install Node.js dependencies
RUN yarn install

# Copy the rest of the application code
COPY . /app/

# Expose the port the app runs on
EXPOSE 8080

# Command to migrate the database and start the application
CMD chmod -R 777 node_modules/prisma && chmod -R 777 node_modules/.prisma && npx prisma migrate dev && yarn serve
