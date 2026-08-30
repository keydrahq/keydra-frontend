# The interface alone, served as static files behind a proxy that routes /api and /graphql to
# the backend.
#
#   podman build -t keydra-ui:dev -f Containerfile .
#   podman run --rm -p 8080:8080 -e KEYDRA_BACKEND=http://host.containers.internal:8181 keydra-ui:dev
#
# The ordinary deployment is the single image built in keydrahq/keydra, which carries this
# interface inside the backend so one container answers both. This one exists for the
# deployments where that is the wrong shape: an interface in front of several API replicas, or
# an estate that already has somewhere to put a single-page application.
#
# It proxies rather than letting the browser call the API across origins, and that is not a
# preference: the session is a cookie, and a cookie sent to another origin needs SameSite=None
# and a CORS policy that allows credentials. One origin to the browser is fewer things to get
# wrong, and it is the arrangement the single image already has.

# --- Stage 1: build -----------------------------------------------------------
# The one stage that is not a Red Hat base image.
#
# ubi10/nodejs-24 does exist — an earlier version of this comment said it did not, and was
# wrong. What it ships is Node 24.18.0 against the 24.19.0 this project pins in .nvmrc and in
# `engines.node`, and it carries neither yarn nor corepack, so using it means a root step and
# an `npm install -g corepack` over the network before the build can start.
#
# Not worth it here, and the reason is what this stage is: everything it produces is a
# directory of static files that the next stage copies out, and the image itself is thrown
# away. The errata feed that makes a Red Hat base the right answer for a runtime — the image
# still running a month from now — buys nothing for a builder nobody runs.
#
# Revisit when UBI's stream catches up to the pin; it becomes a one-line change plus corepack.
FROM docker.io/library/node:24-alpine AS build

WORKDIR /build

# Dependencies first: they change far less often than the source, so this layer is reused
# across almost every rebuild.
COPY package.json yarn.lock .yarnrc.yml ./
RUN corepack enable && yarn install --immutable

COPY . .
RUN yarn build

# --- Stage 2: serve -----------------------------------------------------------
# UBI's nginx runs as an unprivileged user, listens above 1024, and keeps its writable state
# in directories that are group-writable — which is what makes it start under an arbitrary
# UID, the way OpenShift assigns one.
FROM registry.access.redhat.com/ubi10/nginx-126:latest

USER root

COPY --from=build --chown=1001:0 /build/dist/ /opt/app-root/src/

# Two config files, into two directories, because nginx cares which. `nginx.d` is included at
# the http level, which is the only place a `map` is allowed; `nginx.default.d` is included
# inside the server block, which is where a `location` belongs. Getting them the wrong way
# round is a container that will not start, with a message about an unexpected directive.
COPY --chown=1001:0 deploy/nginx-http.conf /opt/app-root/etc/nginx.d/keydra-ui.conf
# The server half is a template rather than a file: the backend's address is substituted at
# start-up, so one image serves any deployment instead of one image per deployment.
COPY --chown=1001:0 deploy/nginx-server.conf.template /opt/app-root/etc/nginx-server.conf.template
COPY --chown=1001:0 deploy/start.sh /opt/app-root/bin/start.sh
RUN chmod +x /opt/app-root/bin/start.sh

USER 1001

# Where the API is. Named at run time rather than baked in, and the default is what the
# manifests in keydrahq/keydra call the backend's Service.
ENV KEYDRA_BACKEND="http://keydra-backend:8181"

EXPOSE 8080

# The site is static files with a proxy in front: if the index answers, nginx is serving. It
# says nothing about the backend on purpose — an interface that reports itself unhealthy
# because the API it proxies to is down is an interface that cannot show you the error.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD ["sh", "-c", "curl -fsS http://localhost:8080/ >/dev/null || exit 1"]

CMD ["/opt/app-root/bin/start.sh"]
