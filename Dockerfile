FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY server.js .
COPY public/ public/

# Create data directory with subdirectories
RUN mkdir -p /app/data/uploads

# Set data directory as volume for persistence
VOLUME ["/app/data"]

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
