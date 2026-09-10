# The static site image for color-picker. Caddy serves the committed files from
# /srv as uid 1000 with no build step, and answers GET /health with 200.
FROM caddy@sha256:d8c17a862962def15cde69863a3a463f25a2664942eafd7bdbf050e9c3116b83

ARG VCS_REF
LABEL org.opencontainers.image.source="https://github.com/breeze4/color-picker"
LABEL org.opencontainers.image.revision="${VCS_REF}"

# curl serves the health check. Removing the binding capability from the Caddy
# binary keeps an unprivileged process from claiming a privileged port.
USER root
RUN apk add --no-cache curl libcap \
  && setcap -r /usr/bin/caddy
COPY deploy/container.Caddyfile /etc/caddy/Caddyfile
COPY frontend /srv
RUN chown -R 1000:1000 /srv /etc/caddy/Caddyfile

USER 1000:1000
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:8080/health || exit 1
