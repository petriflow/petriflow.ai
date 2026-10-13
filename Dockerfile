# syntax=docker/dockerfile:1.7

# Pin the same Node/Alpine manifest for native-addon build and runtime.
# Update this digest together with the Node patch version.
ARG NODE_IMAGE=node:22.23.3-alpine3.24

# Install runtime libraries once so both stages start with the same libxml2/JVM packages.
FROM ${NODE_IMAGE} AS runtime-base
WORKDIR /app
RUN apk add --no-cache ca-certificates libxml2 openjdk21

# ---- build ----
FROM runtime-base AS build

# libxmljs2 is native: compile it against the same Node ABI and Alpine base used at runtime.
RUN apk add --no-cache g++ libxml2-dev make python3

RUN corepack enable

# Include workspace config before install: it allows the libxmljs2 build script.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Keep build-only packages out of the runtime image.
RUN pnpm prune --prod

# ---- runtime ----
FROM runtime-base AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0

ARG GROOVY_VERSION=4.0.33

# JVM + Groovy power action validation. Verify the pinned Apache binary before installing it.
RUN apk add --no-cache --virtual .groovy-install-deps curl unzip \
    && curl --fail --silent --show-error --location \
      "https://archive.apache.org/dist/groovy/${GROOVY_VERSION}/distribution/apache-groovy-binary-${GROOVY_VERSION}.zip" \
      --output /tmp/groovy.zip \
    && unzip -q /tmp/groovy.zip -d /opt \
    && rm /tmp/groovy.zip \
    && apk del .groovy-install-deps \
    && ln -s "/opt/groovy-${GROOVY_VERSION}/bin/groovy" /usr/local/bin/groovy

COPY --from=build --chown=node:node /app/dist ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules

# StorageService creates dist/storage and CacheService writes dist/cache.json at runtime.
RUN mkdir -p /app/storage && chown -R node:node /app

# Use a named volume at this path to preserve synchronized releases across container replacement.
VOLUME ["/app/storage"]

USER node
EXPOSE 3000
CMD ["node", "--enable-source-maps", "server.cjs"]
