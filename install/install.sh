#!/usr/bin/env bash
# ============================================================================
#  Bivvo Docs — Auto-instalador com interface interativa
#
#  Rodar direto (recomendado):
#    curl -fsSL -o /tmp/bivvo-docs-install.sh https://raw.githubusercontent.com/lcstrindade/cherish-future-echo/main/install/install.sh && sudo bash /tmp/bivvo-docs-install.sh
#
#  Também suporta pipe:
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

# Quando o script vem por pipe (`curl ... | sudo bash`), o stdin é o próprio
# código do instalador. Se tentarmos ler o menu desse mesmo stdin, o Bash
# termina antes de mostrar as opções. Por isso, primeiro reexecutamos uma cópia
# real em /tmp; só esse segundo processo troca o stdin para /dev/tty.
_SRC="${BASH_SOURCE[0]:-}"
if { [ -z "$_SRC" ] || [ ! -f "$_SRC" ]; } && [ "${BIVVO_INSTALL_FROM_FILE:-0}" != "1" ]; then
  need_root
  TMP_INSTALLER="/tmp/bivvo-docs-install.sh"
  command -v curl >/dev/null || die "curl não encontrado. Use: apt-get install -y curl"
  curl -fsSL "https://raw.githubusercontent.com/lcstrindade/cherish-future-echo/${REPO_BRANCH}/install/install.sh" -o "$TMP_INSTALLER"
  chmod 700 "$TMP_INSTALLER"
  if [ -r /dev/tty ]; then
    exec env BIVVO_INSTALL_FROM_FILE=1 bash "$TMP_INSTALLER" </dev/tty
  fi
  die "Terminal interativo não encontrado. Rode: curl -fsSL -o /tmp/bivvo-docs-install.sh https://raw.githubusercontent.com/lcstrindade/cherish-future-echo/${REPO_BRANCH}/install/install.sh && sudo bash /tmp/bivvo-docs-install.sh"
fi

# ---------- self-bootstrap (curl | sudo bash) ------------------------------
if [ -z "$_SRC" ] || [ ! -f "$_SRC" ] || [ ! -f "$(dirname "$_SRC")/../package.json" ]; then
  banner
  section "Bootstrap"
  need_root
  step "Preparando repositório local do instalador"
  command -v git >/dev/null || { apt-get update -y >/dev/null 2>&1 || true; apt-get install -y git >/dev/null; }
  APP_DIR="${APP_DIR:-$DEFAULT_INSTALL_DIR}"
  ok "Diretório de instalação: $APP_DIR"
  if [ -d "$APP_DIR/.git" ]; then
    ok "Instalação existente encontrada — abrindo o menu sem atualizar automaticamente"
  else
    mkdir -p "$(dirname "$APP_DIR")"
    run "Clonando $REPO_URL em $APP_DIR" git clone --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
  fi
  SCRIPT_DIR="$APP_DIR/install"
  cd "$APP_DIR"
  if [ -r /dev/tty ] && [ ! -t 0 ]; then
    exec < /dev/tty
  fi
else
  SCRIPT_DIR="$(cd "$(dirname "$_SRC")" && pwd)"
  APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  cd "$APP_DIR"
fi

# ---------- dependency management ------------------------------------------
APT_UPDATED=0
apt_install() { # apt_install pkg1 pkg2...
  if [ $APT_UPDATED -eq 0 ]; then
    step "Atualizando índice apt (ignorando repositórios de terceiros com erro)"
    if apt-get update -y >/tmp/bivvo-install.log 2>&1; then
      ok "Índice apt atualizado"
    else
      warn "apt-get update retornou avisos (provavelmente repositório de terceiros quebrado) — seguindo mesmo assim"
      tail -n 5 /tmp/bivvo-install.log || true
    fi
    APT_UPDATED=1
  fi
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

  if command -v node >/dev/null; then
    local installed_v; installed_v="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
    if [ "$installed_v" -ge 20 ]; then
      ok "Node.js $(node -v) instalado"
      return
    fi
  fi

  warn "O apt instalou Node.js antigo ou manteve a versão anterior — instalando Node.js 20 via binário oficial"
  install_node20_binary
  local final_v; final_v="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
  [ "$final_v" -ge 20 ] || die "Não foi possível instalar Node.js 20. Versão atual: $(node -v 2>/dev/null || echo ausente)"
  ok "Node.js $(node -v) instalado"
}

install_node20_binary() {
  local node_version="${NODE_VERSION:-20.19.5}" arch node_dir tarball url
  case "$(uname -m)" in
    x86_64|amd64) arch="x64" ;;
    aarch64|arm64) arch="arm64" ;;
    armv7l) arch="armv7l" ;;
    *) die "Arquitetura não suportada para instalação automática do Node.js: $(uname -m)" ;;
  esac

  command -v xz >/dev/null || apt_install xz-utils
  node_dir="/usr/local/lib/node-v${node_version}-linux-${arch}"
  tarball="/tmp/node-v${node_version}-linux-${arch}.tar.xz"
  url="https://nodejs.org/dist/v${node_version}/node-v${node_version}-linux-${arch}.tar.xz"

  run "Baixando Node.js ${node_version} (${arch})" curl -fsSL "$url" -o "$tarball"
  rm -rf "$node_dir"
  run "Extraindo Node.js ${node_version}" tar -xJf "$tarball" -C /usr/local/lib
  ln -sfn "$node_dir/bin/node" /usr/local/bin/node
  ln -sfn "$node_dir/bin/npm" /usr/local/bin/npm
  ln -sfn "$node_dir/bin/npx" /usr/local/bin/npx
  [ -x "$node_dir/bin/corepack" ] && ln -sfn "$node_dir/bin/corepack" /usr/local/bin/corepack
  hash -r 2>/dev/null || true
}

ensure_bun() {
  if command -v bun >/dev/null; then ok "Bun $(bun -v) já instalado"; return; fi
  command -v unzip >/dev/null || apt_install unzip
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
  command -v unzip   >/dev/null || pkgs+=(unzip)
  command -v xz      >/dev/null || pkgs+=(xz-utils)
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
  used="$( {
    ss -tlnH 2>/dev/null | awk '{print $4}' | awk -F: '{print $NF}' || true
    grep -rhoE 'proxy_pass[[:space:]]+https?://(127\.0\.0\.1|localhost):[0-9]+' /etc/nginx 2>/dev/null | grep -oE '[0-9]+$' || true
    grep -rhoE '^PORT=[0-9]+' "$STATE_DIR" 2>/dev/null | cut -d= -f2 || true
  } | sort -u || true )"
  for ((p=start; p<=end; p++)); do
    if ! grep -qx "$p" <<<"$used"; then echo "$p"; return 0; fi
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

set_env_key() {
  local file="$1" key="$2" value="$3"
  touch "$file"
  if grep -qE "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf "%s=%s\n" "$key" "$value" >> "$file"
  fi
}

ensure_runtime_env() {
  section "Validando variáveis runtime"
  [ -f "$APP_DIR/.env" ] || die "Arquivo .env não encontrado em $APP_DIR/.env"
  set_env_key "$APP_DIR/.env" "PORT" "$PORT"
  set_env_key "$APP_DIR/.env" "HOST" "127.0.0.1"
  set_env_key "$APP_DIR/.env" "NITRO_PORT" "$PORT"
  set_env_key "$APP_DIR/.env" "NITRO_HOST" "127.0.0.1"
  set_env_key "$APP_DIR/.env" "NODE_ENV" "production"
  chown "$APP_USER":"$APP_USER" "$APP_DIR/.env" 2>/dev/null || true
  chmod 600 "$APP_DIR/.env"
  ok "Runtime configurado para 127.0.0.1:$PORT"
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

sync_repo_to_origin() {
  section "Sincronizando código com GitHub"
  local env_bak="/tmp/${PROJECT:-bivvo-docs}-env-update-$$.bak"
  [ -f "$APP_DIR/.env" ] && cp -a "$APP_DIR/.env" "$env_bak" || true
  run "git remote origin" git -C "$APP_DIR" remote set-url origin "$REPO_URL"
  run "git fetch origin/$REPO_BRANCH" git -C "$APP_DIR" fetch origin "$REPO_BRANCH" --prune
  run "git checkout/reset $REPO_BRANCH" git -C "$APP_DIR" checkout -f -B "$REPO_BRANCH" "origin/$REPO_BRANCH"
  run "git reset hard origin/$REPO_BRANCH" git -C "$APP_DIR" reset --hard "origin/$REPO_BRANCH"
  run "Limpando arquivos gerados locais" git -C "$APP_DIR" clean -fd -e .env
  [ -f "$env_bak" ] && mv -f "$env_bak" "$APP_DIR/.env" || true
}

validate_install_inputs() {
  PROJECT="$(printf '%s' "$PROJECT" | tr '[:upper:]' '[:lower:]')"
  DOMAIN="$(printf '%s' "$DOMAIN" | sed -E 's#^https?://##; s#/.*$##; s#:[0-9]+$##')"

  [[ "$PROJECT" =~ ^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$ ]] || die "Nome do projeto inválido. Use apenas letras minúsculas, números e hífen. Ex.: bivvo-docs"
  [[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "Domínio inválido. Informe apenas o host, ex.: docs.seudominio.com.br"
  [[ "$APP_USER" =~ ^[a-z_][a-z0-9_-]*[$]?$ ]] || die "Usuário Linux inválido: $APP_USER"

  if [ -f "/etc/systemd/system/${PROJECT}.service" ] || [ -f "$STATE_DIR/$PROJECT.env" ]; then
    confirm "Já existe uma instância chamada '$PROJECT'. Deseja sobrescrever/reconfigurar?" || die "Use a opção 2 (Atualizar) ou escolha outro slug."
  fi

  if grep -RqsE "server_name[[:space:]].*\b${DOMAIN//./\.}\b" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null; then
    warn "Já existe configuração Nginx para $DOMAIN. O instalador criará/atualizará o vhost '$PROJECT'."
  fi
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

  validate_install_inputs

  SESSION_SECRET="$(openssl rand -hex 32)"
  PORT="$(find_free_port 3000 3999)"
  ok "Porta local livre escolhida: $PORT"

  echo
  section "Resumo"
  printf "  Projeto : %s\n  Domínio : %s\n  Porta   : %s\n  Dir     : %s\n  Usuário : %s\n" \
    "$PROJECT" "$DOMAIN" "$PORT" "$APP_DIR" "$APP_USER"
  confirm "Confirma e prossegue com o deploy?" || die "Abortado pelo usuário."
}

ensure_app_user() {
  section "Validando usuário do serviço"
  if id "$APP_USER" >/dev/null 2>&1; then
    ok "Usuário Linux '$APP_USER' encontrado"
    return
  fi

  warn "Usuário '$APP_USER' não existe — criando usuário de sistema sem login"
  run "Criando usuário $APP_USER" useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
}

ensure_repo_clone() {
  section "Preparando código-fonte em $APP_DIR"
  if [ -d "$APP_DIR/.git" ]; then
    ok "Repositório já presente em $APP_DIR"
    sync_repo_to_origin
    return
  fi
  if [ -d "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then
    warn "Diretório $APP_DIR existe e não é um clone git — movendo para ${APP_DIR}.bak-$$"
    mv "$APP_DIR" "${APP_DIR}.bak-$$"
  fi
  mkdir -p "$(dirname "$APP_DIR")"
  run "Clonando $REPO_URL (branch $REPO_BRANCH) em $APP_DIR" \
    git clone --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
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
NITRO_PORT=$PORT
NITRO_HOST=127.0.0.1
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

check_runtime_permissions() {
  section "Validando permissões de execução"
  local check_cmd="test -x '$APP_DIR' && test -r '$APP_DIR/.env' && test -r '$APP_DIR/.output/server/index.mjs'"
  if command -v runuser >/dev/null 2>&1; then
    if runuser -u "$APP_USER" -- bash -c "$check_cmd" >/tmp/bivvo-install.log 2>&1; then
      ok "Usuário '$APP_USER' consegue ler o build e o .env"
      return 0
    fi
  else
    warn "Comando runuser não encontrado; pulando validação avançada de permissões"
    return 0
  fi

  err "Usuário '$APP_USER' não consegue acessar $APP_DIR"
  warn "Se o projeto estiver em /root, mova para /opt/bivvo-docs ou use DEFAULT_INSTALL_DIR=/opt/bivvo-docs."
  tail -n 20 /tmp/bivvo-install.log || true
  exit 1
}

print_service_diagnostics() {
  echo
  section "Diagnóstico do serviço"
  systemctl status "$PROJECT" --no-pager -l || true
  echo
  warn "Logs recentes do systemd:"
  journalctl -u "$PROJECT" -n 120 --no-pager || true

  if [ -f "/var/log/${PROJECT}.err.log" ] || [ -f "/var/log/${PROJECT}.log" ]; then
    echo
    warn "Logs legados em /var/log (instalações antigas):"
    [ -f "/var/log/${PROJECT}.err.log" ] && { echo "--- /var/log/${PROJECT}.err.log"; tail -n 80 "/var/log/${PROJECT}.err.log" || true; }
    [ -f "/var/log/${PROJECT}.log" ] && { echo "--- /var/log/${PROJECT}.log"; tail -n 80 "/var/log/${PROJECT}.log" || true; }
  fi

  echo
  warn "Portas escutando no servidor:"
  ss -tlnp 2>/dev/null | grep -E "(:${PORT}[[:space:]]|Local Address)" || true

  echo
  warn "Teste curl detalhado da healthcheck:"
  curl -v --noproxy '*' --max-time 8 "http://127.0.0.1:${PORT}/api/public/health" -o /tmp/bivvo-health-body.txt 2>&1 || true
  [ -s /tmp/bivvo-health-body.txt ] && { echo "--- resposta"; cat /tmp/bivvo-health-body.txt; echo; }

  echo
  warn "Teste curl detalhado da página /docs:"
  curl -v --noproxy '*' --max-time 8 "http://127.0.0.1:${PORT}/docs" -o /tmp/bivvo-docs-body.txt 2>&1 || true
  [ -s /tmp/bivvo-docs-body.txt ] && { echo "--- resposta"; cat /tmp/bivvo-docs-body.txt; echo; }
}

wait_for_app() {
  section "Verificando aplicação local"
  local health_url="http://127.0.0.1:${PORT}/api/public/health" docs_url="http://127.0.0.1:${PORT}/docs" code docs_code attempt
  for attempt in {1..45}; do
    if ! systemctl is-active --quiet "$PROJECT"; then
      warn "Serviço ainda não está ativo (tentativa $attempt/45)"
    fi

    code="$(curl -fsS --noproxy '*' -o /tmp/bivvo-app-health.html -w "%{http_code}" --max-time 3 "$health_url" 2>/tmp/bivvo-health-curl.err || true)"
    if [[ "$code" =~ ^(2|3)[0-9][0-9]$ ]]; then
      ok "Aplicação respondeu localmente em $health_url (HTTP $code)"

      docs_code="$(curl -fsS --noproxy '*' -o /tmp/bivvo-docs-health.html -w "%{http_code}" --max-time 8 "$docs_url" 2>/tmp/bivvo-docs-curl.err || true)"
      if [[ "$docs_code" =~ ^(2|3)[0-9][0-9]$ ]]; then
        ok "Página /docs respondeu localmente (HTTP $docs_code)"
      else
        warn "Servidor está online, mas /docs retornou HTTP ${docs_code:-sem resposta}. Verifique schema/credenciais do Supabase se a página mostrar erro."
      fi
      return 0
    fi

    if [ "$code" = "404" ]; then
      docs_code="$(curl -fsS --noproxy '*' -o /tmp/bivvo-docs-health.html -w "%{http_code}" --max-time 8 "$docs_url" 2>/tmp/bivvo-docs-curl.err || true)"
      if [[ "$docs_code" =~ ^(2|3)[0-9][0-9]$ ]]; then
        warn "A rota /api/public/health não existe neste build, mas a aplicação respondeu em /docs (HTTP $docs_code)."
        ok "Aplicação local online em http://127.0.0.1:${PORT}/docs"
        return 0
      fi
    fi
    sleep 1
  done

  err "A aplicação não respondeu com sucesso em $health_url nem em $docs_url"
  print_service_diagnostics
  return 1
}

verify_nginx_route() {
  section "Verificando rota local do Nginx"
  local url="http://127.0.0.1/api/public/health" docs_url="http://127.0.0.1/docs" code docs_code
  code="$(curl -fsS -o /tmp/bivvo-nginx-health.html -w "%{http_code}" --max-time 3 -H "Host: $DOMAIN" "$url" 2>/dev/null || true)"
  if [[ "$code" =~ ^(2|3)[0-9][0-9]$ ]]; then
    ok "Nginx encaminhou $DOMAIN para a aplicação (HTTP $code)"
    return 0
  fi

  if [ "$code" = "404" ]; then
    docs_code="$(curl -fsS -o /tmp/bivvo-nginx-docs.html -w "%{http_code}" --max-time 8 -H "Host: $DOMAIN" "$docs_url" 2>/dev/null || true)"
    if [[ "$docs_code" =~ ^(2|3)[0-9][0-9]$ ]]; then
      warn "Healthcheck dedicada não encontrada via Nginx, mas /docs respondeu (HTTP $docs_code)."
      ok "Nginx encaminhou $DOMAIN para a aplicação"
      return 0
    fi
  fi

  warn "Nginx não retornou sucesso para $DOMAIN ainda (HTTP ${code:-sem resposta})"
  warn "Veja: nginx -t && tail -n 80 /var/log/nginx/${PROJECT}.error.log"
  return 0
}

install_service() {
  section "Configurando serviço systemd"
  local svc="/etc/systemd/system/${PROJECT}.service" node_bin node_major
  node_bin="$(command -v node || true)"
  [ -n "$node_bin" ] || die "Node.js não encontrado após instalação das dependências."
  node_major="$($node_bin -v | sed 's/^v\([0-9]*\).*/\1/')"
  [ "$node_major" -ge 20 ] || die "Node.js do serviço precisa ser 20+. Encontrado: $($node_bin -v) em $node_bin"
  ok "Serviço usará Node.js $($node_bin -v) em $node_bin"
  sed -e "s|__PROJECT__|$PROJECT|g" -e "s|__USER__|$APP_USER|g" \
      -e "s|__APPDIR__|$APP_DIR|g" -e "s|__PORT__|$PORT|g" \
      -e "s|__NODE_BIN__|$node_bin|g" \
      "$SCRIPT_DIR/service.template" > "$svc"
  run "systemctl daemon-reload" systemctl daemon-reload
  run "Habilitando $PROJECT.service" systemctl enable "$PROJECT"
  systemctl reset-failed "$PROJECT" >/dev/null 2>&1 || true
  run "Iniciando $PROJECT.service"   systemctl restart "$PROJECT"
  sleep 2
  if systemctl is-active --quiet "$PROJECT"; then ok "Serviço ativo"
  else err "Serviço não subiu — journalctl -u $PROJECT -n 50"; exit 1; fi
  if ! wait_for_app; then
    die "Serviço iniciou, mas a aplicação não respondeu na porta $PORT. Veja o diagnóstico acima."
  fi
}

install_nginx() {
  section "Publicando vhost Nginx"
  local conf="/etc/nginx/sites-available/${PROJECT}.conf"
  mkdir -p /var/www/certbot
  run "Garantindo Nginx ativo" systemctl enable --now nginx
  sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__PORT__|$PORT|g" -e "s|__PROJECT__|$PROJECT|g" \
      "$SCRIPT_DIR/nginx.conf.template" > "$conf"
  ln -sf "$conf" "/etc/nginx/sites-enabled/${PROJECT}.conf"
  run "nginx -t" nginx -t
  run "systemctl reload nginx" systemctl reload nginx
  verify_nginx_route
}

setup_ssl() {
  section "SSL (Let's Encrypt via Certbot)"
  if confirm "Emitir certificado agora para $DOMAIN?"; then
    command -v certbot >/dev/null || apt_install certbot python3-certbot-nginx
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
  ensure_app_user
  write_env
  save_state
  build_app
  check_runtime_permissions
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
  ensure_app_user
  ensure_runtime_env
  sync_repo_to_origin
  build_app
  check_runtime_permissions
  install_service
  install_nginx
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
  ensure_runtime_env
  run "Reiniciando $PROJECT" systemctl restart "$PROJECT"
  wait_for_app || die "Serviço reiniciou, mas não respondeu na porta $PORT."
  run "Recarregando nginx"   systemctl reload nginx
  ok "Reiniciado"
}

# ---------- fluxo: renovar SSL ---------------------------------------------
do_ssl() {
  banner; need_root
  section "Renovar / emitir SSL"; pick_install
  command -v certbot >/dev/null || apt_install certbot python3-certbot-nginx
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