FROM dunglas/frankenphp:php8.4-bookworm

RUN install-php-extensions bcmath gd zip pdo_mysql

COPY . /app
WORKDIR /app

RUN composer install --ignore-platform-reqs --no-scripts --no-interaction
RUN npm install
RUN npm run build

RUN mkdir -p storage/framework/{sessions,views,cache,testing} storage/logs bootstrap/cache
RUN chmod -R a+rw storage bootstrap/cache

CADDYFILE_APACHE_CONVERTED=<<EOF
{
    admin off
    auto_https off
    https_port 8080
}

:8080 {
    root * /app/public
    php
    handle_errors {
        respond "Error {err.status_code}"
    }
}
EOF

RUN echo "$CADDYFILE_APACHE_CONVERTED" > /etc/caddy/Caddyfile

CMD ["frankenphp", "run", "--config", "/etc/caddy/Caddyfile"]