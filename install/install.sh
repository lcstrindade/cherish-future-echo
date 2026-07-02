#!/usr/bin/env bash
# ============================================================================
# Bivvo Docs — Auto-instalador
# Uso rápido (uma linha, clona o repo automaticamente):
#   curl -fsSL https://raw.githubusercontent.com/lcstrindade/cherish-future-echo/main/install/install.sh | sudo bash
#
# Uso a partir de um clone existente:
#   sudo bash install/install.sh
#
# O script:
#  1. Se rodado fora de um clone, faz git clone do repositório oficial
#  2. Verifica dependências (git, node >=20, bun, nginx, openssl)
#  3. Coleta credenciais interativamente (Supabase, admin, domínio)
#  4. Descobre uma porta local livre (não conflita com outros vhosts/nginx)
#  5. Gera .env, faz build (Nitro node-server) e instala serviço systemd
#  6. Publica vhost Nginx apontando o domínio -> 127.0.0.1:PORTA
#  7. (opcional) Emite certificado Let's Encrypt via certbot --nginx
# ============================================================================
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/lcstrindade/cherish-future-echo.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
INSTALL_ROOT="${INSTALL_ROOT:-/opt}"

# Se o script foi baixado solto (curl | bash), $BASH_SOURCE aponta pra /dev/stdin.
# Nesse caso, clonamos o repo e reexecutamos o install.sh de dentro dele.
_SRC="${BASH_SOURCE[0]:-}"
if [ -z "$_SRC" ] || [ ! -f "$_SRC" ] || [ ! -f "$(dirname "$_SRC")/../package.json" ]; then
  if [ "$(id -u)" -ne 0 ]; then
    echo "Rode como root: curl -fsSL <url> | sudo bash"; exit 1
  fi
  command -v git >/dev/null || { apt-get update -y && apt-get install -y git; }
  read -rp "Diretório de instalação [$INSTALL_ROOT/bivvo-docs]: " _dir || true
  APP_DIR="${_dir:-$INSTALL_ROOT/bivvo-docs}"
  if [ -d "$APP_DIR/.git" ]; then
    echo "==> Repositório já existe em $APP_DIR — atualizando"
    git -C "$APP_DIR" fetch --all --prune
    git -C "$APP_DIR" checkout "$REPO_BRANCH"
    git -C "$APP_DIR" pull --ff-only
  else
    echo "==> Clonando $REPO_URL em $APP_DIR"
    mkdir -p "$(dirname "$APP_DIR")"
    git clone --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
  fi
  exec bash "$APP_DIR/install/install.sh"
fi

SCRIPT_DIR="$(cd "$(dirname "$_SRC")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"

c_red()  { printf '\033[31m%s\033[0m\n' "$*"; }
c_grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
c_ylw()  { printf '\033[33m%s\033[0m\n' "$*"; }
c_bld()  { printf '\033[1m%s\033[0m\n' "$*"; }

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    c_red "Rode como root: sudo bash install/install.sh"; exit 1
  fi
}

ask() { # ask VAR "pergunta" "default"
  local __var="$1" __q="$2" __def="${3:-}" __val
  if [ -n "$__def" ]; then
    read -rp "$__q [$__def]: " __val || true
    __val="${__val:-$__def}"
  else
    while [ -z "${__val:-}" ]; do read -rp "$__q: " __val || true; done
  fi
  printf -v "$__var" '%s' "$__val"
}

ask_secret() { # ask_secret VAR "pergunta"
  local __var="$1" __q="$2" __val
  while [ -z "${__val:-}" ]; do
    read -rsp "$__q: " __val; echo
  done
  printf -v "$__var" '%s' "$__val"
}

# --- 1) Dependências --------------------------------------------------------
check_deps() {
  c_bld "==> Verificando dependências"
  local missing=()
  command -v git     >/dev/null || missing+=("git")
  command -v node    >/dev/null || missing+=("nodejs>=20")
  command -v nginx   >/dev/null || missing+=("nginx")
  command -v openssl >/dev/null || missing+=("openssl")
  command -v ss      >/dev/null || missing+=("iproute2")
  if [ ${#missing[@]} -gt 0 ]; then
    c_red "Faltando: ${missing[*]}"
    c_ylw "No Debian/Ubuntu: apt update && apt install -y git nodejs nginx openssl iproute2"
    exit 1
  fi
  if ! command -v bun >/dev/null; then
    c_ylw "bun não encontrado — instalando..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
  fi
  local node_major
  node_major="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
  if [ "$node_major" -lt 20 ]; then
    c_red "Node.js 20+ é obrigatório (encontrado: $(node -v))"; exit 1
  fi
  c_grn "OK"
}

# --- 2) Descobrir porta livre ----------------------------------------------
# Considera portas usadas por (a) qualquer processo em LISTEN e
# (b) qualquer 'proxy_pass http://127.0.0.1:PORT' em /etc/nginx.
find_free_port() {
  local start="${1:-3000}" end="${2:-3999}" p
  local used
  used="$(
    { ss -tlnH 2>/dev/null | awk '{print $4}' | awk -F: '{print $NF}';
      grep -rhoE 'proxy_pass[[:space:]]+https?://(127\.0\.0\.1|localhost):[0-9]+' /etc/nginx 2>/dev/null \
        | grep -oE '[0-9]+$';
    } | sort -u
  )"
  for ((p=start; p<=end; p++)); do
    if ! grep -qx "$p" <<<"$used"; then echo "$p"; return; fi
  done
  c_red "Nenhuma porta livre entre $start e $end"; exit 1
}

# --- 3) Coleta ---------------------------------------------------------------
collect_inputs() {
  c_bld "==> Configuração"
  ask PROJECT      "Nome do projeto (slug, ex: bivvo-docs)" "bivvo-docs"
  ask DOMAIN       "Domínio (ex: docs.seusite.com.br)"
  ask APP_USER     "Usuário do sistema que rodará o serviço" "www-data"

  echo
  c_bld "-- Supabase --"
  ask SUPABASE_URL              "SUPABASE_URL (ex: https://xxxx.supabase.co)"
  ask SUPABASE_PUBLISHABLE_KEY  "SUPABASE_PUBLISHABLE_KEY (anon key)"
  ask_secret SUPABASE_SERVICE_ROLE_KEY "SUPABASE_SERVICE_ROLE_KEY (secreto)"

  echo
  c_bld "-- Admin --"
  ask ADMIN_USERNAME "Usuário admin" "admin"
  ask_secret ADMIN_PASSWORD "Senha admin"

  echo
  c_bld "-- Opcional --"
  ask LOVABLE_API_KEY "LOVABLE_API_KEY (embeddings — enter para pular)" " "
  [ "$LOVABLE_API_KEY" = " " ] && LOVABLE_API_KEY=""

  SESSION_SECRET="$(openssl rand -hex 32)"
  PORT="$(find_free_port 3000 3999)"
  c_grn "Porta livre escolhida: $PORT"
}

# --- 4) .env ----------------------------------------------------------------
write_env() {
  c_bld "==> Gravando .env em $APP_DIR/.env"
  umask 077
  cat > "$APP_DIR/.env" <<EOF
# Gerado por install.sh em $(date -Iseconds)
SUPABASE_URL=$SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY
ADMIN_USERNAME=$ADMIN_USERNAME
ADMIN_PASSWORD=$ADMIN_PASSWORD
SESSION_SECRET=$SESSION_SECRET
LOVABLE_API_KEY=$LOVABLE_API_KEY
PORT=$PORT
HOST=127.0.0.1
NODE_ENV=production
EOF
  chown "$APP_USER":"$APP_USER" "$APP_DIR/.env" 2>/dev/null || true
  chmod 600 "$APP_DIR/.env"
  umask 022
}

# --- 5) Build ---------------------------------------------------------------
build_app() {
  c_bld "==> Instalando dependências + build (Nitro node-server)"
  ( cd "$APP_DIR" && bun install --frozen-lockfile 2>/dev/null || bun install )
  ( cd "$APP_DIR" && NITRO_PRESET=node-server bun run build )
  if [ ! -f "$APP_DIR/.output/server/index.mjs" ]; then
    c_red "Build falhou: .output/server/index.mjs não encontrado"; exit 1
  fi
  chown -R "$APP_USER":"$APP_USER" "$APP_DIR/.output" 2>/dev/null || true
}

# --- 6) systemd -------------------------------------------------------------
install_service() {
  c_bld "==> Instalando serviço systemd: $PROJECT"
  local svc="/etc/systemd/system/${PROJECT}.service"
  sed -e "s|__PROJECT__|$PROJECT|g" \
      -e "s|__USER__|$APP_USER|g" \
      -e "s|__APPDIR__|$APP_DIR|g" \
      -e "s|__PORT__|$PORT|g" \
      "$SCRIPT_DIR/service.template" > "$svc"
  systemctl daemon-reload
  systemctl enable "$PROJECT"
  systemctl restart "$PROJECT"
  sleep 2
  systemctl --no-pager --lines=10 status "$PROJECT" || true
}

# --- 7) Nginx ---------------------------------------------------------------
install_nginx() {
  c_bld "==> Publicando vhost Nginx para $DOMAIN"
  local conf="/etc/nginx/sites-available/${PROJECT}.conf"
  sed -e "s|__DOMAIN__|$DOMAIN|g" \
      -e "s|__PORT__|$PORT|g" \
      -e "s|__PROJECT__|$PROJECT|g" \
      "$SCRIPT_DIR/nginx.conf.template" > "$conf"
  ln -sf "$conf" "/etc/nginx/sites-enabled/${PROJECT}.conf"
  # Bloqueia SSL até o certbot rodar (evita 'ssl_certificate not found')
  sed -i 's|^\(\s*listen 443.*\)|# \1|; s|^\(\s*listen \[::\]:443.*\)|# \1|' "$conf"
  if nginx -t; then
    systemctl reload nginx
    c_grn "Nginx recarregado"
  else
    c_red "nginx -t falhou; revise $conf"; exit 1
  fi
}

# --- 8) SSL opcional --------------------------------------------------------
setup_ssl() {
  read -rp "Emitir certificado Let's Encrypt agora com certbot? [y/N]: " ans || true
  if [[ "${ans:-n}" =~ ^[yY]$ ]]; then
    if ! command -v certbot >/dev/null; then
      c_ylw "certbot não instalado — apt install -y certbot python3-certbot-nginx"
      apt-get update -y && apt-get install -y certbot python3-certbot-nginx
    fi
    # Restaura o bloco 443 comentado
    local conf="/etc/nginx/sites-available/${PROJECT}.conf"
    sed -i 's|^# \(\s*listen 443.*\)|\1|; s|^# \(\s*listen \[::\]:443.*\)|\1|' "$conf"
    certbot --nginx -d "$DOMAIN" --redirect --agree-tos --non-interactive -m "admin@$DOMAIN" || \
      c_ylw "certbot falhou — rode manualmente depois: certbot --nginx -d $DOMAIN"
    systemctl reload nginx
  fi
}

main() {
  require_root
  check_deps
  collect_inputs

  echo
  c_bld "==> Resumo"
  echo "  Projeto : $PROJECT"
  echo "  Domínio : $DOMAIN"
  echo "  Porta   : $PORT"
  echo "  App dir : $APP_DIR"
  echo "  Usuário : $APP_USER"
  echo
  read -rp "Confirma e prosseguir com o deploy? [y/N]: " ans || true
  [[ "${ans:-n}" =~ ^[yY]$ ]] || { c_ylw "Abortado"; exit 0; }

  write_env
  build_app
  install_service
  install_nginx
  setup_ssl

  echo
  c_grn "==================================================="
  c_grn " Instalação concluída!"
  c_grn "==================================================="
  echo " URL         : https://$DOMAIN"
  echo " Admin login : https://$DOMAIN/auth  (usuário: $ADMIN_USERNAME)"
  echo " Logs        : journalctl -u $PROJECT -f"
  echo " Serviço     : systemctl {status|restart|stop} $PROJECT"
  echo
  c_ylw "ANTES do primeiro acesso: execute install/schema.sql no seu Supabase"
  c_ylw "e crie um usuário admin em Authentication + linha em public.user_roles."
}

main "$@"