FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Set build-time environment variables for Vite
ARG VITE_USE_CSHARP_API=true
ARG VITE_API_BASE_URL=http://localhost:5174
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_USE_CSHARP_API=$VITE_USE_CSHARP_API
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

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