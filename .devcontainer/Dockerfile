# syntax=docker/dockerfile:1@sha256:87999aa3d42bdc6bea60565083ee17e86d1f3339802f543c0d03998580f9cb89

FROM mcr.microsoft.com/playwright:v1.62.1-noble@sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e

USER root

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade --yes --no-install-recommends \
    && DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends make sudo \
    && install --directory --owner ubuntu --group ubuntu \
        /home/ubuntu/.local \
        /home/ubuntu/.local/bin \
        /home/ubuntu/.local/lib \
        /home/ubuntu/.local/lib/node_modules \
    && printf '%s\n' 'ubuntu ALL=(root) NOPASSWD:ALL' > /etc/sudoers.d/ubuntu \
    && chmod 0440 /etc/sudoers.d/ubuntu \
    && rm -rf /var/lib/apt/lists/*

ENV NPM_CONFIG_PREFIX=/home/ubuntu/.local
ENV PATH=/home/ubuntu/.local/bin:${PATH}

USER ubuntu
