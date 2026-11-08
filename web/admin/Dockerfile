# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
COPY shared/package.json ./shared/package.json
COPY admin/package.json ./admin/package.json
RUN cd admin && npm install --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
COPY shared ./shared
COPY --from=deps /app/admin/node_modules ./admin/node_modules
COPY admin ./admin
ARG NEXT_PUBLIC_API_URL=https://api.mekatanker.shop/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NODE_ENV=production
WORKDIR /app/admin
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/shared ./shared
COPY --from=build /app/admin/package.json ./admin/package.json
COPY --from=build /app/admin/node_modules ./admin/node_modules
COPY --from=build /app/admin/.next ./admin/.next
COPY --from=build /app/admin/public ./admin/public
WORKDIR /app/admin
EXPOSE 3000
CMD ["npm", "run", "start"]
