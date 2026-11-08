# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
COPY shared/package.json ./shared/package.json
COPY public/package.json ./public/package.json
RUN cd public && npm install --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
COPY shared ./shared
COPY --from=deps /app/public/node_modules ./public/node_modules
COPY public ./public
ARG NEXT_PUBLIC_API_URL=https://api.mekatanker.shop/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
WORKDIR /app/public
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/public/out /usr/share/nginx/html
COPY public/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
