FROM dunglas/frankenphp:php8.4-bookworm

RUN install-php-extensions bcmath gd zip pdo_mysql

COPY . /app

WORKDIR /app

RUN composer install --ignore-platform-reqs --no-scripts --no-interaction

RUN mkdir -p storage/framework/{sessions,views,cache,testing} storage/logs bootstrap/cache

RUN chmod -R a+rw storage bootstrap/cache

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8080"]