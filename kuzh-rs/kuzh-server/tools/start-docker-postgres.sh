#!/bin/sh
PGVOLUMEDATA="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )/../pgdata"
mkdir -p "$PGVOLUMEDATA" && \
(docker rm -f kuzh-db || true) && \
exec docker run \
  --name kuzh-db \
  -e POSTGRES_PASSWORD=kuzh \
  -e POSTGRES_USER=kuzh \
  -e POSTGRES_DB=kuzh \
  -e PGDATA=/var/lib/postgresql/data \
  -v "$PGVOLUMEDATA:/var/lib/postgresql/data" \
  -p 5432:5432 \
  postgres:latest