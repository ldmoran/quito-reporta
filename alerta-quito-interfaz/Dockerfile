# ---- 1) compilar ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx ng build --configuration production

# ---- 2) servir con nginx ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/alerta-quito-interfaz/browser /usr/share/nginx/html
# En compose el API se llama "servicio"; en otro entorno se cambia con API_UPSTREAM.
ENV API_UPSTREAM=http://servicio:8080
EXPOSE 80
