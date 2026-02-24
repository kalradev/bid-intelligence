# Bid Intelligence Frontend (React + Vite)
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (use legacy-peer-deps if your package.json has overrides)
RUN npm install --legacy-peer-deps

COPY . .

# Build-time: backend API port so browser knows where to call (same host, port 8000)
ARG VITE_API_PORT=8000
ENV VITE_API_PORT=$VITE_API_PORT

RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Serve SPA: fallback to index.html for client-side routes
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
