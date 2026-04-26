#!/usr/bin/env bash
# ==============================================================
# Deploy manual del frontend OVIF en produccion
# ==============================================================
# Uso:
#   ./scripts/deploy-production.sh
#
# Para instalar dependencias:
#   RUN_NPM_CI=1 ./scripts/deploy-production.sh
#   WEB_ROOT=/var/www/ovif ./scripts/deploy-production.sh
#
# Para cambiar el directorio de build (si se cambia el outputPath en angular.json):
# WEB_ROOT=/var/www/ovif RUN_NPM_CI=1 ./scripts/deploy-production.sh
# ==============================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_ROOT="${WEB_ROOT:-/var/www/ovif}"
BUILD_DIR="${BUILD_DIR:-dist/ovif-frontend/browser}"
RUN_NPM_CI="${RUN_NPM_CI:-0}"

cd "$ROOT_DIR"

case "$WEB_ROOT" in
  /var/www/*) ;;
  *)
    echo "ERROR: WEB_ROOT debe estar dentro de /var/www. Valor recibido: $WEB_ROOT"
    exit 1
    ;;
esac

if [[ ! -d "$WEB_ROOT" ]]; then
  echo "ERROR: no existe el directorio destino: $WEB_ROOT"
  exit 1
fi

echo "[$(date)] Iniciando deploy frontend desde: $ROOT_DIR"

if [[ "$RUN_NPM_CI" == "1" ]]; then
  echo "[$(date)] Instalando dependencias..."
  npm ci
fi

echo "[$(date)] Generando build de produccion..."
npx ng build --configuration production

if [[ ! -d "$BUILD_DIR" ]]; then
  echo "ERROR: no existe el directorio de build esperado: $BUILD_DIR"
  exit 1
fi

echo "[$(date)] Publicando build en: $WEB_ROOT"
if command -v rsync >/dev/null 2>&1; then
  sudo rsync -a --delete "${BUILD_DIR}/" "${WEB_ROOT}/"
else
  echo "[$(date)] rsync no esta disponible; usando limpieza y copia con cp"
  sudo find "$WEB_ROOT" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  sudo cp -a "${BUILD_DIR}/." "$WEB_ROOT/"
fi

echo "[$(date)] Validando nginx..."
sudo nginx -t

echo "[$(date)] Recargando nginx..."
sudo systemctl reload nginx

echo "[$(date)] Deploy frontend completado"
