# ==============================================================================
# Multi-stage Dockerfile for JC's Workshop ZA (Production-Ready & Development)
# ==============================================================================

FROM node:20-alpine AS base

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies
RUN npm ci || npm install

# Copy source files
COPY . .

# Build Vite static assets
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Start server (Vite preview or development server bound to 0.0.0.0:3000)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
