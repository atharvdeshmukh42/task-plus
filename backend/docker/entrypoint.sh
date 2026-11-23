#!/bin/sh
set -e
# Apply database migrations before the API starts.
alembic upgrade head
exec "$@"
