# syntax=docker/dockerfile:1@sha256:ecfaec9ed6d810b56388c508f4121597bfbba70d41a6dfeee4d8cad5f295fc32

FROM docker.io/library/node:24-trixie@sha256:f7d34e58713740f9eef9092c0bd6ff10369d132f7238399a4b270f16d47fa608

USER root

ENV NPM_CONFIG_PREFIX=/home/node/.local
ENV PATH=/home/node/.local/bin:${PATH}
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN npx --yes playwright@1.63.0 install --with-deps chromium firefox webkit \
    && rm -rf /root/.npm /var/lib/apt/lists/*

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade --yes --no-install-recommends \
    && DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends make sudo \
    && install --directory --owner node --group node \
        /home/node/.local \
        /home/node/.local/bin \
        /home/node/.local/lib \
        /home/node/.local/lib/node_modules \
    && printf '%s\n' 'node ALL=(root) NOPASSWD:ALL' > /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node \
    && rm -rf /var/lib/apt/lists/*

USER node
