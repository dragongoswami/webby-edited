FROM dunglas/frankenphp:php8.4-bookworm

RUN install-php-extensions bcmath gd zip pdo_mysql

COPY . /app
WORKDIR /app

RUN composer install --ignore-platform-reqs --no-scripts --no-interaction
RUN npm install
RUN npm run build

RUN mkdir -p storage/framework/{sessions,views,cache,testing} storage/logs bootstrap/cache
RUN chmod -R a+rw storage bootstrap/cache

EXPOSE 8080

CMD ["frankenphp", "run", "--port", "8080", "--root", "/app/public"]