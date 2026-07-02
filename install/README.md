# Bivvo Docs — Instalação em servidor externo

Guia rápido para publicar a Central de Ajuda em um VPS (Debian/Ubuntu)
usando **Nginx + systemd** e um **Supabase externo** (self-hosted ou
supabase.com).

Repositório oficial: <https://github.com/lcstrindade/cherish-future-echo>

---

## 1. Pré-requisitos no servidor

- Ubuntu 22.04+ / Debian 12+ com acesso `sudo`
- Domínio (ou subdomínio) apontando um `A` record para o IP do servidor
- Pacotes base:

```bash
sudo apt update
sudo apt install -y git curl nginx openssl iproute2 ca-certificates
# Node.js 20+ (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

O instalador cuida do resto (Bun, systemd, vhost Nginx, Certbot opcional).

---

## 2. Provisionar o Supabase

1. Crie um projeto Supabase (ou use um existente).
2. No **SQL Editor**, cole e execute `install/schema.sql` inteiro. Isso cria:
   - extensões `vector`, `pg_trgm`, `unaccent`
   - tabelas `articles`, `user_roles` (com RLS e GRANTs)
   - função `search_articles` (busca híbrida)
   - bucket privado `article-media` + policies
   - um artigo de boas-vindas
3. Em **Authentication → Users**, crie o usuário admin (email + senha).
4. Em **SQL Editor**, atribua o papel `admin` a esse usuário:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'admin@seudominio.com';
```

5. Anote em **Project Settings → API**:
   - `Project URL`
   - `anon public` (publishable key)
   - `service_role` (secreto — nunca commitar)

---

## 3. Instalação automática (uma linha)

No servidor, como root:

```bash
curl -fsSL https://raw.githubusercontent.com/lcstrindade/cherish-future-echo/main/install/install.sh | sudo bash
```

O script:

1. Clona o repositório em `/opt/bivvo-docs` (perguntará o caminho).
2. Instala Bun se necessário e valida Node ≥ 20, Nginx, OpenSSL, git.
3. Pergunta interativamente:
   - Nome do projeto (slug — permite múltiplas instâncias no mesmo host)
   - Domínio público
   - Usuário do sistema (padrão `www-data`)
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - Usuário e senha do admin
   - `LOVABLE_API_KEY` (opcional — habilita embeddings/reindex)
4. **Detecta uma porta livre** entre 3000–3999 checando tanto `ss -tln`
   quanto todos os `proxy_pass 127.0.0.1:PORT` já configurados em
   `/etc/nginx` — assim não colide com outros projetos já instalados no
   mesmo servidor.
5. Grava `.env` com `chmod 600`, roda `bun install` + build
   (`NITRO_PRESET=node-server`).
6. Publica um serviço systemd `<projeto>.service` e um vhost
   `sites-available/<projeto>.conf` fazendo proxy do domínio para a
   porta local.
7. Oferece rodar `certbot --nginx` para emitir SSL Let's Encrypt.

Ao final:

- App: `https://SEU_DOMINIO`
- Login admin: `https://SEU_DOMINIO/auth`
- Logs: `journalctl -u <projeto> -f`
- Controle: `systemctl {status|restart|stop} <projeto>`

---

## 4. Instalação manual (alternativa)

```bash
sudo git clone https://github.com/lcstrindade/cherish-future-echo.git /opt/bivvo-docs
cd /opt/bivvo-docs
sudo bash install/install.sh
```

Use o modo manual se quiser inspecionar o código antes de rodar o
instalador ou fixar em uma branch/tag específica:

```bash
sudo REPO_BRANCH=v1.2.0 bash install/install.sh
```

---

## 5. Atualizar para uma nova versão

```bash
cd /opt/bivvo-docs
sudo git pull
sudo -u www-data bun install
sudo -u www-data NITRO_PRESET=node-server bun run build
sudo systemctl restart <projeto>
```

Se `install/schema.sql` mudou, reaplique **apenas as novas migrations**
no SQL Editor do Supabase (o arquivo é idempotente via `if not exists`,
mas revise antes de rodar em produção).

---

## 6. Múltiplas instâncias no mesmo servidor

Rode o instalador novamente com outro **slug de projeto** e outro
**domínio**. A detecção de porta livre garante que cada instância use
uma porta local diferente e cada vhost aponte para o serviço correto.

```bash
sudo bash /opt/bivvo-docs/install/install.sh   # docs.clienteA.com
sudo bash /opt/bivvo-docs/install/install.sh   # docs.clienteB.com
```

---

## 7. Variáveis de ambiente (`.env`)

Geradas automaticamente pelo instalador — veja `install/.env.example`.
Nunca commite este arquivo. O `SESSION_SECRET` é gerado com
`openssl rand -hex 32`.

---

## 8. Desinstalar

```bash
sudo systemctl disable --now <projeto>
sudo rm /etc/systemd/system/<projeto>.service
sudo rm /etc/nginx/sites-enabled/<projeto>.conf /etc/nginx/sites-available/<projeto>.conf
sudo systemctl reload nginx
sudo rm -rf /opt/bivvo-docs
```

No Supabase, remova as tabelas rodando o bloco `drop` correspondente ou
delete o projeto inteiro.

---

## 9. Troubleshooting

| Sintoma | Verificar |
| --- | --- |
| `502 Bad Gateway` | `systemctl status <projeto>` e `journalctl -u <projeto> -n 100` |
| Build falha | Node ≥ 20? `node -v`. Espaço em disco? `df -h`. |
| Login admin não funciona | Usuário existe em `auth.users` **e** em `public.user_roles` com role `admin`? |
| Busca vazia | Rode "Reindexar busca" no `/admin` (requer `LOVABLE_API_KEY`). |
| SSL falhou | `sudo certbot --nginx -d SEU_DOMINIO` manualmente após o DNS propagar. |