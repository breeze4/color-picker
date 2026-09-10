#!/bin/sh
# The service-side deployment contract for the color-picker static site. Each
# check reads a file in this repository only. The beebaby-infra gate owns every
# check that spans two repositories, such as the port registry entry and the
# Caddy route.
#
# Usage: sh scripts/check-deployment.sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

# The container filesystem is read-only and the stack publishes no port of its
# own.
grep -Fq 'read_only: true' "$root/compose.yaml"
if grep -Fq 'ports:' "$root/compose.yaml"; then exit 1; fi

# The image records the commit it was built from, runs the Caddy release that
# the edge runs, and serves as uid 1000.
grep -Fq 'org.opencontainers.image.revision="${VCS_REF}"' "$root/Dockerfile"
grep -Fq 'FROM caddy@sha256:' "$root/Dockerfile"
grep -Fq 'USER 1000:1000' "$root/Dockerfile"
grep -Fq 'user: "1000:1000"' "$root/compose.yaml"

# The container answers the health path that the project record probes.
grep -Fq 'respond /health 200' "$root/deploy/container.Caddyfile"
grep -Fq 'http://127.0.0.1:8080/health' "$root/Dockerfile"

# The check image and the Buildx plugin are pinned by digest, and the publish
# step needs no privileged container.
grep -Fq 'pull_request' "$root/.woodpecker/check.yaml"
grep -Fq 'ghcr.io/breeze4/beebaby-ci@sha256:' "$root/.woodpecker/check.yaml"
grep -Fq 'woodpeckerci/plugin-docker-buildx@sha256:ccb9072d4f51dc6ec106b364c6806c6647c93c59594f2d10d121f94b0566591f' "$root/.woodpecker/publish.yaml"
if grep -Fq 'privileged:' "$root/.woodpecker/publish.yaml"; then exit 1; fi

# The workflows run in order: check, then publish, then deploy.
grep -Fqx '  - check' "$root/.woodpecker/publish.yaml"
grep -Fqx '  - publish' "$root/.woodpecker/deploy.yaml"

printf 'check-deployment: color-picker meets the static service-side contract\n'
