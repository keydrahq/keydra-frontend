#!/bin/sh
# Substitutes the backend's address into the configuration and starts nginx.
#
# A build-time value would mean an image per deployment, which is the thing a container image
# exists not to be. envsubst is given the one variable to replace by name — without that list
# it would also eat nginx's own $host, $remote_addr and $connection_upgrade, and the failure
# that produces is a config that starts and forwards nothing useful.
set -eu

: "${KEYDRA_BACKEND:=http://keydra-backend:8181}"
export KEYDRA_BACKEND

envsubst '${KEYDRA_BACKEND}' < /opt/keydra/etc/nginx.conf.template > /tmp/nginx.conf

# Said once at start-up, because "the interface is up but nothing works" is otherwise a
# question about a value nobody can see.
echo "keydra-ui: /api and /graphql go to ${KEYDRA_BACKEND}"

nginx -c /tmp/nginx.conf -t
exec nginx -c /tmp/nginx.conf -g "daemon off;"
