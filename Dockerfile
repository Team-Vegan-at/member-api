# Check out https://hub.docker.com/_/node to select a new base image
FROM node:14-slim as build-stage

# Set to a non-root built-in user `node`
USER node

# Create app directory (with user `node`)
RUN mkdir -p /home/node/app

WORKDIR /home/node/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY --chown=node package*.json ./

# Bundle app source code
COPY --chown=node . .

RUN yarn set version berry

RUN yarn install


RUN yarn run build && \
  yarn cache clean

FROM node:14-alpine as run-stage

# Set to a non-root built-in user `node`
USER node

# Create app directory (with user `node`)
RUN mkdir -p /home/node/app

WORKDIR /home/node/app

# Copy cache from Stage 1
COPY --from=build-stage /home/node/app /home/node/app

# Bind to all network interfaces so that it can be mapped to the host OS
ENV HOST=0.0.0.0 PORT=3000

# Build-time metadata as defined at http://label-schema.org
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION
LABEL org.label-schema.build-date=$BUILD_DATE \
  org.label-schema.name="Team Vegan.at API" \
  org.label-schema.description="Team Vegan.at API" \
  org.label-schema.url="https://api.teamvegan.at/" \
  org.label-schema.vcs-ref=$VCS_REF \
  org.label-schema.vcs-url="https://github.com/Team-Vegan-at/member-api/" \
  org.label-schema.vendor="Team Vegan.at" \
  org.label-schema.version=$VERSION \
  org.label-schema.schema-version="1.0"

EXPOSE ${PORT}
CMD [ "node", "." ]
