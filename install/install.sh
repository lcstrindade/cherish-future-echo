#!/usr/bin/env bash
# ============================================================================
#  Bivvo Docs — Auto-instalador com interface interativa
#
#  Rodar direto (uma linha):
#    curl -fsSL https://raw.githubusercontent.com/lcstrindade/cherish-future-echo/main/install/install.sh | sudo bash
#
#  Rodar de um clone local:
#    sudo bash install/install.sh
#
#  O instalador mostra tudo o que está fazendo, checa pré-requisitos,
#  instala/atualiza o que faltar, e oferece um menu com:
#    1) Instalar        2) Atualizar        3) Status
#    4) Reiniciar       5) Renovar SSL      6) Desinstalar     0) Sair
# ============================================================================
set -Eeuo pipefail

# Reanexa stdin ao terminal quando o script é executado via pipe
# (ex.: `curl ... | sudo bash`), senão `read` recebe EOF e o menu fecha sozinho.
if [ ! -t 0 ] && [ -r /dev/tty ]; then
  exec </dev/tty
fi

REPO_URL="${REPO_URL:-https://github.com/lcstrindade/cherish-future-echo.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
DEFAULT_INSTALL_DIR="${DEFAULT_INSTALL_DIR:-/opt/bivvo-docs}"
STATE_DIR="/etc/bivvo-docs"

# ---------- UI helpers ------------------------------------------------------
if [ -t 1 ]; then
  C_R=$'\033[31m'; C_G=$'\033[32m'; C_Y=$'\033[33m'; C_B=$'\033[34m'
  C_M=$'\033[35m'; C_C=$'\033[36m'; C_W=$'\033[37m'; C_D=$'\033[2m'
  C_BLD=$'\033[1m'; C_N=$'\033[0m'
else
  C_R=""; C_G=""; C_Y=""; C_B=""; C_M=""; C_C=""; C_W=""; C_D=""; C_BLD=""; C_N=""
fi

banner() {
  clear || true
  cat <<EOF
${C_C}${C_BLD}
 ╔══════════════════════════════════════════════════════════════════╗
 ║                                                                  ║
 ║        Bivvo Docs  ·  Auto-instalador                            ║
 ║        Central de Ajuda / Documentação self-hosted               ║
 ║                                                                  ║
 ╚══════════════════════════════════════════════════════════════════╝
${C_N}
EOF
}

section() { printf "\n${C_B}${C_BLD}▎ %s${C_N}\n" "$*"; }
step()    { printf "  ${C_C}➜${C_N} %s\n" "$*"; }
ok()      { printf "  ${C_G}✔${C_N} %s\n" "$*"; }
warn()    { printf "  ${C_Y}⚠${C_N} %s\n" "$*"; }
err()     { printf "  ${C_R}✘${C_N} %s\n" "$*" >&2; }
die()     { err "$*"; exit 1; }

run() { # run "descrição" cmd args...
  local desc="$1"; shift
  step "$desc"
  if "$@" >/tmp/bivvo-install.log 2>&1; then
    ok  "$desc"
  else
    err "$desc — falhou"
    printf "${C_D}"; tail -n 20 /tmp/bivvo-install.log; printf "${C_N}"
    exit 1
  fi
}

ask()        { local __v="$1" __q="$2" __d="${3:-}" __x
               if [ -n "$__d" ]; then read -rp "  $__q [${C_D}$__d${C_N}]: " __x || true; __x="${__x:-$__d}"
               else while [ -z "${__x:-}" ]; do read -rp "  $__q: " __x || true; done; fi
               printf -v "$__v" '%s' "$__x"; }
ask_secret() { local __v="$1" __q="$2" __x
               while [ -z "${__x:-}" ]; do read -rsp "  $__q: " __x; echo; done
               printf -v "$__v" '%s' "$__x"; }
confirm()    { local ans; read -rp "  $1 [y/N]: " ans || true; [[ "${ans:-n}" =~ ^[yY]$ ]]; }

need_root() { [ "$(id -u)" -eq 0 ] || die "Rode como root (sudo)."; }

# ---------- self-bootstrap (curl | sudo bash) ------------------------------
_SRC="${BASH_SOURCE[0]:-}"
if [ -z "$_SRC" ] || [ ! -f "$_SRC" ] || [ ! -f "$(dirname "$_SRC")/../package.json" ]; then
  banner
  section "Bootstrap"
  need_root
  step "Instalando git (se necessário) e clonando o repositório"
  command -v git >/dev/null || { apt-get update -y >/dev/null 2>&1 || true; apt-get install -y git >/dev/null; }
  ask APP_DIR "Diretório de instalação" "$DEFAULT_INSTALL_DIR"
  if [ -d "$APP_DIR/.git" ]; then
    run "Atualizando repositório existente em $APP_DIR" \
      bash -c "git -C '$APP_DIR' fetch --all --prune && git -C '$APP_DIR' checkout '$REPO_BRANCH' && git -C '$APP_DIR' pull --ff-only"
  else
    mkdir -p "$(dirname "$APP_DIR")"
    run "Clonando $REPO_URL em $APP_DIR" git clone --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
  fi
  exec bash "$APP_DIR/install/install.sh"
fi

SCRIPT_DIR="$(cd "$(dirname "$_SRC")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"

# ---------- dependency management ------------------------------------------
APT_UPDATED=0
apt_install() { # apt_install pkg1 pkg2...
  [ $APT_UPDATED -eq 0 ] && { run "Atualizando índice apt" apt-get update -y; APT_UPDATED=1; }
  run "Instalando pacote(s): $*" apt-get install -y "$@"
}

ensure_node20() {
  if command -v node >/dev/null; then
    local v; v="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
    if [ "$v" -ge 20 ]; then ok "Node.js $(node -v) já instalado"; return; fi
    warn "Node.js $(node -v) é antigo — atualizando para 20.x"
  else
    step "Node.js ausente — instalando 20.x via NodeSource"
  fi
  run "Baixando setup NodeSource 20.x" bash -c 'curl -fsSL https://deb.nodesource.com/setup_20.x | bash -'
  apt_install nodejs
  ok "Node.js $(node -v) instalado"
}

ensure_bun() {
  if command -v bun >/dev/null; then ok "Bun $(bun -v) já instalado"; return; fi
  step "Instalando Bun (runtime JS)"
  run "Baixando bun" bash -c 'curl -fsSL https://bun.sh/install | bash'
  export PATH="$HOME/.bun/bin:$PATH"
  [ -x "$HOME/.bun/bin/bun" ] && ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bun
  ok "Bun $(bun -v) instalado"
}

ensure_deps() {
  section "Checando dependências do sistema"
  local pkgs=()
  command -v git     >/dev/null || pkgs+=(git)
  command -v nginx   >/dev/null || pkgs+=(nginx)
  command -v openssl >/dev/null || pkgs+=(openssl)
  command -v ss      >/dev/null || pkgs+=(iproute2)
  command -v curl    >/dev/null || pkgs+=(curl)
  command -v ca-certificates >/dev/null 2>&1 || pkgs+=(ca-certificates)
  if [ ${#pkgs[@]} -gt 0 ]; then
    warn "Faltando: ${pkgs[*]} — instalando"
    apt_install "${pkgs[@]}"
  else
    ok "git, nginx, openssl, iproute2, curl já presentes"
  fi
  ensure_node20
  ensure_bun
}

# ---------- port discovery --------------------------------------------------
find_free_port() {
  local start="${1:-3000}" end="${2:-3999}" p used
  used="$( { ss -tlnH 2>/dev/null | awk '{print $4}' | awk -F: '{print $NF}';
             grep -rhoE 'proxy_pass[[:space:]]+https?://(127\.0\.0\.1|localhost):[0-9]+' /etc/nginx 2>/dev/null | grep -oE '[0-9]+$';
           } | sort -u )"
  for ((p=start; p<=end; p++)); do
    grep -qx "$p" <<<"$used" || { echo "$p"; return; }
  done
  die "Nenhuma porta livre entre $start e $end"
}

# ---------- state (para update/uninstall) -----------------------------------
save_state() {
  mkdir -p "$STATE_DIR"
  cat > "$STATE_DIR/$PROJECT.env" <<EOF
PROJECT=$PROJECT
DOMAIN=$DOMAIN
APP_DIR=$APP_DIR
APP_USER=$APP_USER
PORT=$PORT
EOF
  chmod 600 "$STATE_DIR/$PROJECT.env"
}
load_state() { # load_state <projeto>
  local f="$STATE_DIR/$1.env"; [ -f "$f" ] || die "Instalação '$1' não encontrada em $STATE_DIR"
  # shellcheck disable=SC1090
  source "$f"
}
list_installs() {
  [ -d "$STATE_DIR" ] || { echo "  (nenhuma instalação registrada)"; return 1; }
  local found=0
  for f in "$STATE_DIR"/*.env; do
    [ -f "$f" ] || continue
    ( # shellcheck disable=SC1090
      source "$f"; printf "  ${C_G}•${C_N} %-20s  %-30s  porta %s\n" "$PROJECT" "$DOMAIN" "$PORT" )
    found=1
  done
  [ $found -eq 0 ] && { echo "  (nenhuma instalação registrada)"; return 1; }
  return 0
}
pick_install() {
  list_installs || return 1
  local sel; ask sel "Slug do projeto"
  load_state "$sel"
}

# ---------- fluxo: instalar -------------------------------------------------
collect_inputs() {
  section "Configuração da instância"
  ask PROJECT      "Nome do projeto (slug único)" "bivvo-docs"
  ask DOMAIN       "Domínio público (ex: docs.seusite.com.br)"
  ask APP_USER     "Usuário do sistema" "www-data"

  section "Credenciais do Supabase"
  ask SUPABASE_URL             "SUPABASE_URL"
  ask SUPABASE_PUBLISHABLE_KEY "SUPABASE_PUBLISHABLE_KEY (anon)"
  ask_secret SUPABASE_SERVICE_ROLE_KEY "SUPABASE_SERVICE_ROLE_KEY (secreto)"

  section "Credenciais do admin do painel"
  ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -hex 18)}"
  ok "Admin definido automaticamente: usuário '$ADMIN_USERNAME' e senha forte gerada pelo instalador"

  SESSION_SECRET="$(openssl rand -hex 32)"
  PORT="$(find_free_port 3000 3999)"
  ok "Porta local livre escolhida: $PORT"

  echo
  section "Resumo"
  printf "  Projeto : %s\n  Domínio : %s\n  Porta   : %s\n  Dir     : %s\n  Usuário : %s\n" \
    "$PROJECT" "$DOMAIN" "$PORT" "$APP_DIR" "$APP_USER"
  confirm "Confirma e prossegue com o deploy?" || die "Abortado pelo usuário."
}

write_env() {
  section "Gravando .env"
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
PORT=$PORT
HOST=127.0.0.1
NODE_ENV=production
EOF
  chown "$APP_USER":"$APP_USER" "$APP_DIR/.env" 2>/dev/null || true
  chmod 600 "$APP_DIR/.env"

  mkdir -p "$STATE_DIR"
  cat > "$STATE_DIR/${PROJECT}-admin.txt" <<EOF
Bivvo Docs — credenciais iniciais do painel
URL: https://$DOMAIN/auth
Usuário: $ADMIN_USERNAME
Senha: $ADMIN_PASSWORD

Estas credenciais foram geradas automaticamente pelo instalador.
Para trocar depois, edite $APP_DIR/.env e reinicie a instância pelo menu.
EOF
  chmod 600 "$STATE_DIR/${PROJECT}-admin.txt"
  umask 022
  ok ".env gravado com chmod 600"
  ok "Credenciais iniciais salvas em $STATE_DIR/${PROJECT}-admin.txt (somente root)"
}

build_app() {
  section "Instalando dependências do app e fazendo build"
  run "bun install"                 bash -c "cd '$APP_DIR' && bun install"
  run "Build (Nitro node-server)"   bash -c "cd '$APP_DIR' && NITRO_PRESET=node-server bun run build"
  [ -f "$APP_DIR/.output/server/index.mjs" ] || die "Build não gerou .output/server/index.mjs"
  chown -R "$APP_USER":"$APP_USER" "$APP_DIR/.output" 2>/dev/null || true
}

install_service() {
  section "Configurando serviço systemd"
  local svc="/etc/systemd/system/${PROJECT}.service"
  sed -e "s|__PROJECT__|$PROJECT|g" -e "s|__USER__|$APP_USER|g" \
      -e "s|__APPDIR__|$APP_DIR|g" -e "s|__PORT__|$PORT|g" \
      "$SCRIPT_DIR/service.template" > "$svc"
  run "systemctl daemon-reload" systemctl daemon-reload
  run "Habilitando $PROJECT.service" systemctl enable "$PROJECT"
  run "Iniciando $PROJECT.service"   systemctl restart "$PROJECT"
  sleep 2
  if systemctl is-active --quiet "$PROJECT"; then ok "Serviço ativo"
  else err "Serviço não subiu — journalctl -u $PROJECT -n 50"; exit 1; fi
}

install_nginx() {
  section "Publicando vhost Nginx"
  local conf="/etc/nginx/sites-available/${PROJECT}.conf"
  sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__PORT__|$PORT|g" -e "s|__PROJECT__|$PROJECT|g" \
      "$SCRIPT_DIR/nginx.conf.template" > "$conf"
  ln -sf "$conf" "/etc/nginx/sites-enabled/${PROJECT}.conf"
  # bloqueia SSL até certbot rodar
  sed -i 's|^\(\s*listen 443.*\)|# \1|; s|^\(\s*listen \[::\]:443.*\)|# \1|' "$conf"
  run "nginx -t" nginx -t
  run "systemctl reload nginx" systemctl reload nginx
}

setup_ssl() {
  section "SSL (Let's Encrypt via Certbot)"
  if confirm "Emitir certificado agora para $DOMAIN?"; then
    command -v certbot >/dev/null || apt_install certbot python3-certbot-nginx
    local conf="/etc/nginx/sites-available/${PROJECT}.conf"
    sed -i 's|^# \(\s*listen 443.*\)|\1|; s|^# \(\s*listen \[::\]:443.*\)|\1|' "$conf"
    if certbot --nginx -d "$DOMAIN" --redirect --agree-tos --non-interactive -m "admin@$DOMAIN" >/tmp/bivvo-install.log 2>&1; then
      ok "Certificado emitido"
      systemctl reload nginx
    else
      warn "certbot falhou — rode depois: certbot --nginx -d $DOMAIN"
      tail -n 15 /tmp/bivvo-install.log
    fi
  else
    warn "Pulando SSL. Reative depois: sudo bash install/install.sh (opção 5)"
  fi
}

do_install() {
  banner
  need_root
  ensure_deps
  collect_inputs
  write_env
  build_app
  install_service
  install_nginx
  save_state
  setup_ssl

  echo
  printf "${C_G}${C_BLD}════════════════════════════════════════════════════════════════${C_N}\n"
  printf "${C_G}${C_BLD}  Instalação concluída!${C_N}\n"
  printf "${C_G}${C_BLD}════════════════════════════════════════════════════════════════${C_N}\n"
  echo "  URL          : https://$DOMAIN"
  echo "  Admin login  : https://$DOMAIN/auth  (usuário: $ADMIN_USERNAME)"
  echo "  Senha admin  : salva em $STATE_DIR/${PROJECT}-admin.txt"
  echo "  Logs         : journalctl -u $PROJECT -f"
  echo "  Gerenciar    : sudo bash $APP_DIR/install/install.sh"
  echo
  warn "Antes do 1º acesso: execute install/schema.sql no seu Supabase externo (veja README)."
}

# ---------- fluxo: atualizar ------------------------------------------------
do_update() {
  banner
  need_root
  section "Atualizar instância existente"
  pick_install
  ensure_deps
  section "Puxando código novo de $REPO_URL ($REPO_BRANCH)"
  run "git fetch"       git -C "$APP_DIR" fetch --all --prune
  run "git checkout"    git -C "$APP_DIR" checkout "$REPO_BRANCH"
  run "git pull"        git -C "$APP_DIR" pull --ff-only
  build_app
  run "Reiniciando $PROJECT" systemctl restart "$PROJECT"
  ok "Atualização concluída — https://$DOMAIN"
}

# ---------- fluxo: status ---------------------------------------------------
do_status() {
  banner
  section "Instâncias registradas"
  list_installs || true
  echo
  section "Serviços"
  for f in "$STATE_DIR"/*.env; do
    [ -f "$f" ] || continue
    ( source "$f"
      if systemctl is-active --quiet "$PROJECT"; then
        printf "  ${C_G}●${C_N} %-20s ativo  (porta %s)\n" "$PROJECT" "$PORT"
      else
        printf "  ${C_R}●${C_N} %-20s parado (porta %s)\n" "$PROJECT" "$PORT"
      fi )
  done
}

# ---------- fluxo: restart --------------------------------------------------
do_restart() {
  banner; need_root
  section "Reiniciar instância"; pick_install
  run "Reiniciando $PROJECT" systemctl restart "$PROJECT"
  run "Recarregando nginx"   systemctl reload nginx
  ok "Reiniciado"
}

# ---------- fluxo: renovar SSL ---------------------------------------------
do_ssl() {
  banner; need_root
  section "Renovar / emitir SSL"; pick_install
  command -v certbot >/dev/null || apt_install certbot python3-certbot-nginx
  local conf="/etc/nginx/sites-available/${PROJECT}.conf"
  sed -i 's|^# \(\s*listen 443.*\)|\1|; s|^# \(\s*listen \[::\]:443.*\)|\1|' "$conf"
  certbot --nginx -d "$DOMAIN" --redirect --agree-tos --non-interactive -m "admin@$DOMAIN" || warn "certbot falhou"
  systemctl reload nginx
  ok "Concluído"
}

# ---------- fluxo: desinstalar ---------------------------------------------
do_uninstall() {
  banner; need_root
  section "Desinstalar instância"; pick_install
  confirm "Confirmar remoção de '$PROJECT' ($DOMAIN)?" || { warn "Cancelado"; return; }
  systemctl disable --now "$PROJECT" 2>/dev/null || true
  rm -f "/etc/systemd/system/${PROJECT}.service"
  rm -f "/etc/nginx/sites-enabled/${PROJECT}.conf" "/etc/nginx/sites-available/${PROJECT}.conf"
  systemctl daemon-reload; systemctl reload nginx || true
  rm -f "$STATE_DIR/$PROJECT.env"
  rm -f "$STATE_DIR/${PROJECT}-admin.txt"
  ok "Serviço, vhost e estado removidos."
  if confirm "Remover também o diretório $APP_DIR?"; then rm -rf "$APP_DIR"; ok "Diretório removido"; fi
  warn "Dados no Supabase precisam ser removidos manualmente."
}

# ---------- menu ------------------------------------------------------------
menu() {
  while true; do
    banner
    printf "${C_BLD}  Diretório do repositório:${C_N} %s\n" "$APP_DIR"
    printf "${C_BLD}  Branch:${C_N} %s\n\n" "$REPO_BRANCH"
    cat <<EOF
  ${C_C}${C_BLD}O que você quer fazer?${C_N}

    ${C_G}1${C_N})  Instalar nova instância
    ${C_G}2${C_N})  Atualizar instância existente
    ${C_G}3${C_N})  Ver status das instâncias
    ${C_G}4${C_N})  Reiniciar uma instância
    ${C_G}5${C_N})  Emitir / renovar SSL
    ${C_G}6${C_N})  Desinstalar uma instância
    ${C_G}0${C_N})  Sair

EOF
    local op; read -rp "  Opção: " op || exit 0
    case "${op:-}" in
      1) do_install ;;
      2) do_update ;;
      3) do_status ;;
      4) do_restart ;;
      5) do_ssl ;;
      6) do_uninstall ;;
      0|q|Q) exit 0 ;;
      *) warn "Opção inválida" ;;
    esac
    echo; read -rp "  ⏎ para voltar ao menu..." _ || true
  done
}

trap 'err "Falha inesperada na linha $LINENO. Log: /tmp/bivvo-install.log"' ERR
need_root
menu