FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build


FROM nginx:stable-alpine
WORKDIR /usr/share/nginx/html
COPY --from=builder /app/dist .
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
RUN chown -R nginx:nginx /var/cache/nginx
RUN mkdir -p /run && chown -R nginx:nginx /run
USER nginx
CMD ["nginx", "-g", "daemon off;"]