# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app

# libxmljs2 is a native addon: it needs libxml2 dev headers to compile.
RUN apk add --no-cache python3 make g++ libxml2-dev

COPY package*.json ./
RUN npm i

COPY . .
RUN npm run build   # xmcp build && node build.mjs -> dist/server.cjs + dist/public

# ---- runtime ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# libxml2 shared library required at runtime by the native addon.
# openjdk21 + Groovy are required to run the action-validation daemon.
RUN apk add --no-cache libxml2 openjdk21 curl unzip \
    && curl -sL https://groovy.jfrog.io/artifactory/dist-release-local/groovy-zips/apache-groovy-binary-4.0.24.zip -o /tmp/groovy.zip \
    && unzip -q /tmp/groovy.zip -d /opt \
    && rm /tmp/groovy.zip \
    && ln -s /opt/groovy-4.0.24/bin/groovy /usr/local/bin/groovy

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

USER node
EXPOSE 3000
CMD ["node", "--enable-source-maps", "dist/server.cjs"]
