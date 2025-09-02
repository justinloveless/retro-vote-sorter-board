FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
# Ensure dist directory exists and has proper permissions
RUN ls -la dist/

FROM nginx:stable-alpine
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/dist .
# Ensure files were copied correctly
RUN ls -la
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
RUN chown -R nginx:nginx /var/cache/nginx && \
    mkdir -p /run && \
    chown -R nginx:nginx /run && \
    chown -R nginx:nginx /usr/share/nginx/html
USER nginx
CMD ["nginx", "-g", "daemon off;"]