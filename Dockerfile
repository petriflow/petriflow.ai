# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build   # xmcp build && node build.mjs -> dist/server.cjs + dist/public

# ---- runtime ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000
CMD ["node", "--enable-source-maps", "dist/server.cjs"]
