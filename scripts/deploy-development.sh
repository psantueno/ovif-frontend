#!/usr/bin/env bash
# ==============================================================
# Deploy manual del frontend OVIF en desarrollo
# ==============================================================
# Uso:
#   ./scripts/deploy-development.sh
#
# Opcional:
#   DRY_RUN=1 ./scripts/deploy-development.sh
#   RUN_NPM_CI=1 ./scripts/deploy-development.sh
#   WEB_ROOT=/var/www/ovif ./scripts/deploy-development.sh
#   FRONTEND_CONFIGURATION=production ./scripts/deploy-development.sh
#   BUILD_DIR=dist/ovif-frontend/browser ./scripts/deploy-development.sh
# ==============================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_ROOT="${WEB_ROOT:-/var/www/ovif}"
FRONTEND_CONFIGURATION="${FRONTEND_CONFIGURATION:-development}"
BUILD_DIR="${BUILD_DIR:-dist/ovif-frontend/browser}"
RUN_NPM_CI="${RUN_NPM_CI:-0}"
RELOAD_NGINX="${RELOAD_NGINX:-1}"
DRY_RUN="${DRY_RUN:-0}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

run() {
  log "+ $*"
  if [[ "$DRY_RUN" == "1" ]]; then
    return 0
  fi
  "$@"
}

assert_safe_web_root() {
  [[ -n "$WEB_ROOT" ]] || die "WEB_ROOT no puede estar vacio"
  [[ "$WEB_ROOT" != "/" ]] || die "WEB_ROOT no puede ser /"

  case "$WEB_ROOT" in
    /var/www/*|/home/infrait/*) ;;
    *)
      die "WEB_ROOT debe estar dentro de /var/www o /home/infrait. Valor recibido: $WEB_ROOT"
      ;;
  esac
}

cd "$ROOT_DIR"
assert_safe_web_root

log "Iniciando deploy frontend de desarrollo desde: $ROOT_DIR"
log "Destino frontend: $WEB_ROOT"
log "Configuracion frontend: $FRONTEND_CONFIGURATION"

if [[ "$RUN_NPM_CI" == "1" ]]; then
  log "Instalando dependencias del frontend"
  run npm ci
fi

log "Generando build del frontend"
run npm run build -- --configuration "$FRONTEND_CONFIGURATION"

if [[ "$DRY_RUN" != "1" && ! -d "$BUILD_DIR" ]]; then
  die "no existe el directorio de build esperado: $BUILD_DIR"
fi

log "Publicando frontend en $WEB_ROOT"
run sudo install -d "$WEB_ROOT"

if command -v rsync >/dev/null 2>&1; then
  run sudo rsync -a --delete "$BUILD_DIR/" "$WEB_ROOT/"
else
  log "rsync no esta disponible; usando copia con cp -a"
  run sudo cp -a "$BUILD_DIR/." "$WEB_ROOT/"
fi

if [[ "$RELOAD_NGINX" == "1" ]]; then
  log "Validando nginx"
  run sudo nginx -t

  log "Recargando nginx"
  run sudo systemctl reload nginx
fi

log "Deploy frontend de desarrollo completado"
