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
# nginx installed onto ubi-minimal rather than Red Hat's s2i nginx image.
#
# That image is built to compile an application inside the container, so it carries gdb, vim,
# rsync, python3 and the whole Perl stack: 252 packages against this one's 136, and 159 of
# the vulnerabilities the registry's scanner reported against an image whose entire job is to
# serve files that were built in the stage above. None of those five is here.
#
# What it costs is deploy/nginx.conf.template, which is the whole configuration rather than a
# fragment dropped into somebody else's. That is also what lets the `map` sit where nginx
# requires it without a second file to explain the split.
FROM registry.access.redhat.com/ubi10/ubi-minimal:latest

# gettext is for envsubst, which is how the backend's address reaches the config at start-up.
# `update` ahead of `install`, in the one layer: `latest` is rebuilt on Red Hat's cadence
# while UBI ships errata between those rebuilds, so the tag is where the packages start
# rather than where they currently are.
RUN microdnf -y update \
    && microdnf -y install nginx gettext \
    && microdnf -y clean all \
    && rm -rf /var/cache/yum

# Everything nginx writes goes to /tmp, so the only directories that need an owner are the
# ones holding what it reads. Group 0 rather than a uid, because that is what lets a platform
# assign an arbitrary one — which is what OpenShift does.
# `install -d` rather than mkdir followed by chmod -R: under a rootless build the recursive
# chmod applies to the parent and then fails on the directory it just created, with
# "Operation not permitted" from root, which reads like a broken image rather than a
# recursion quirk. Setting mode, owner and group as the directory is made avoids the
# question. Group 0 rather than a uid, because that is what lets a platform assign an
# arbitrary one — which is what OpenShift does.
RUN install -d -m 0775 -o 1001 -g 0 /opt/keydra /opt/keydra/html /opt/keydra/etc

COPY --from=build --chown=1001:0 /build/dist/ /opt/keydra/html/
COPY --chown=1001:0 deploy/nginx.conf.template /opt/keydra/etc/nginx.conf.template
COPY --chown=1001:0 deploy/start.sh /opt/keydra/start.sh
RUN chmod +x /opt/keydra/start.sh

USER 1001

# Where the API is. Named at run time rather than baked in, and the default is what the
# manifests in keydrahq/keydra call the backend's Service.
ENV KEYDRA_BACKEND="http://keydra-backend:8181"

# Above 1024, so binding it needs no capability.
EXPOSE 8080

# The site is static files with a proxy in front: if the index answers, nginx is serving. It
# says nothing about the backend on purpose — an interface that reports itself unhealthy
# because the API it proxies to is down is an interface that cannot show you the error.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD ["sh", "-c", "curl -fsS http://localhost:8080/ >/dev/null || exit 1"]

CMD ["/opt/keydra/start.sh"]
