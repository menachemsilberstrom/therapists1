#!/bin/sh
# Container start-up.
#
# Persistent disks (Render, Docker volumes) are usually mounted owned by root, but the app must not run as root.
# So: while still root, make sure the uploads folder exists and belongs to the unprivileged "node" user, then
# replace this process with the real command running as "node". Signals (SIGTERM on redeploy) reach the app directly.
set -e

UPLOADS="${UPLOADS_DIR:-/data/uploads}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$UPLOADS"
  chown -R node:node "$UPLOADS"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

# Already unprivileged (for example `docker run --user node`): nothing to prepare, the folder must be writable already.
mkdir -p "$UPLOADS"
exec "$@"
