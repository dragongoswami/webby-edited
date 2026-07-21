# syntax=docker/dockerfile:1.7-labs
FROM debian:trixie-slim AS build

RUN apt-get update \
    && apt-get -y --no-install-recommends install \
        build-essential gcc make autoconf libtool bison \
        dpkg-dev pkg-config re2c locate \
        libmariadb-dev libmariadb-dev-compat libpq-dev libsqlite3-dev \
        libvips-dev default-libmysqlclient-dev libmagickwand-dev \
        libicu-dev libxml2-dev libxslt-dev libyaml-dev \
        sudo curl ca-certificates unzip git \
    && rm -rf /var/lib/apt/lists/*

SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ENV MISE_DATA_DIR="/mise"
ENV MISE_CONFIG_DIR="/mise"
ENV MISE_CACHE_DIR="/mise/cache"
ENV MISE_INSTALL_PATH="/usr/local/bin/mise"
ENV PATH="/mise/shims:$PATH"

RUN curl https://mise.run | sh
RUN mkdir -p /app
RUN mkdir -p /opt/assets
RUN mise use --global "ubi:adwinying/php@8.3.29"
RUN curl -L --output /usr/bin/composer https://github.com/composer/composer/releases/download/2.9.2/composer.phar && chmod +x /usr/bin/composer
RUN mise use --global "node@24"
RUN mise use --global "npm"
WORKDIR /app

COPY . ./

ENV COMPOSER_HOME=/tmp COMPOSER_FUND=0 COMPOSER_ALLOW_SUPERUSER=1
RUN composer install --no-dev --optimize-autoloader --ignore-platform-reqs --no-scripts

ENV CI=true NPM_CONFIG_FUND=false
RUN npm install
RUN npm run build

FROM scratch
COPY --from=build /app /app
COPY --from=build /opt/assets /opt/assets

EXPOSE 3000
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=3000"]