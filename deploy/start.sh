#!/usr/bin/env bash
# Substitutes the backend's address into the server config and starts nginx.
#
# A build-time value would mean an image per deployment, which is the thing a container image
# exists not to be. envsubst is given the one variable to replace by name — without that list
# it would also eat nginx's own $host, $remote_addr and $connection_upgrade, and the failure
# that produces is a config that starts and forwards nothing useful.
set -euo pipefail

: "${KEYDRA_BACKEND:=http://keydra-backend:8181}"
export KEYDRA_BACKEND

envsubst '${KEYDRA_BACKEND}' \
  < /opt/app-root/etc/nginx-server.conf.template \
  > /opt/app-root/etc/nginx.default.d/keydra-ui.conf

# Said once at start-up, because "the interface is up but nothing works" is otherwise a
# question about a value nobody can see.
echo "keydra-ui: /api and /graphql go to ${KEYDRA_BACKEND}"

nginx -t
exec nginx -g "daemon off;"
