# Bivvo Docs — Instalação em servidor próprio

Guia para instalar o sistema em um VPS (Debian/Ubuntu) com **Nginx** e um
**Supabase externo** (self-hosted ou cloud). Um instalador automático faz
tudo (build, systemd, vhost, SSL, detecção de porta livre).

---

## 1) Pré-requisitos do servidor

- Ubuntu 22.04+ / Debian 12+ com acesso root
- Domínio apontando (A/AAAA) para o IP do servidor
- Pacotes:
  ```bash
  sudo apt update
  sudo apt install -y curl git nginx openssl iproute2 ca-certificates
  # Node.js 20 LTS
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
  sudo apt install -y nodejs
  # bun (o instalador tenta instalar sozinho se faltar)
  curl -fsSL https://bun.sh/install | bash
  ```

## 2) Supabase — provisionar o banco

1. Crie um projeto no **Supabase** (cloud https://supabase.com ou self-hosted).
2. Em **SQL Editor**, cole e execute o arquivo [`schema.sql`](./schema.sql).
   Ele cria: extensões (`vector`, `pg_trgm`), tabelas `articles` e
   `user_roles`, políticas RLS, função de busca híbrida `search_articles`,
   bucket de storage `article-media` e um artigo de exemplo.
3. Em **Authentication → Providers → Email**: desative "Confirm email"
   (o admin não precisa confirmar). Desative signups públicos se quiser.
4. Crie o usuário admin em **Authentication → Users → Add user** (email +
   senha). Copie o UUID e rode no SQL Editor:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('<COLE_O_UUID_AQUI>', 'admin');
   ```
5. Anote em **Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` → `SUPABASE_PUBLISHABLE_KEY`
   - `service_role` (secreto!) → `SUPABASE_SERVICE_ROLE_KEY`

## 3) Clonar o código

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone <URL_DO_SEU_REPO> bivvo-docs
cd bivvo-docs
```

## 4) Rodar o instalador

```bash
sudo bash install/install.sh
```

O script vai perguntar:

| Pergunta | O que informar |
|---|---|
| Nome do projeto | slug único (ex.: `bivvo-docs`) — usado no systemd e Nginx |
| Domínio | `docs.seusite.com.br` (já apontado para o IP) |
| Usuário do sistema | `www-data` (padrão) |
| SUPABASE_URL / anon / service_role | valores do passo 2.5 |
| Admin | usuário/senha do painel `/auth` |
| LOVABLE_API_KEY | opcional — habilita busca por embeddings |
| Emitir SSL agora? | `y` para Let's Encrypt via certbot |

Ele automaticamente:

- Verifica dependências (Node ≥20, Nginx, openssl)
- **Detecta uma porta livre** entre 3000–3999 varrendo processos em LISTEN
  e `proxy_pass` de todos os vhosts em `/etc/nginx` (não colide com outros
  projetos já instalados no mesmo servidor)
- Gera `.env` (chmod 600) com `SESSION_SECRET` aleatório
- Faz `bun install` + `NITRO_PRESET=node-server bun run build`
- Cria `/etc/systemd/system/<projeto>.service` e inicia
- Publica `/etc/nginx/sites-available/<projeto>.conf` e recarrega Nginx
- (opcional) Roda `certbot --nginx` para HTTPS

## 5) Após a instalação

```bash
# logs em tempo real
journalctl -u bivvo-docs -f
# reiniciar
sudo systemctl restart bivvo-docs
# atualizar (após git pull)
cd /var/www/bivvo-docs && sudo -u www-data bun install && \
  sudo -u www-data NITRO_PRESET=node-server bun run build && \
  sudo systemctl restart bivvo-docs
```

Acesse `https://SEU_DOMINIO` — a home redireciona para `/docs`. Login admin
em `https://SEU_DOMINIO/auth`.

## 6) Segurança

- O `.env` fica com **chmod 600** e nunca deve ir para o Git
  (`.env` já está no `.gitignore`).
- Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` em variáveis `VITE_*`
  (o instalador já separa corretamente).
- Troque `ADMIN_PASSWORD` para uma senha forte.
- Mantenha o Nginx e o sistema operacional atualizados.
- Habilite firewall (`ufw allow 22,80,443/tcp`).

## 7) Rodar múltiplos projetos no mesmo servidor

Basta rodar o instalador novamente em outro clone/pasta com **nome de
projeto diferente** — ele automaticamente escolhe outra porta livre e cria
um segundo vhost/serviço systemd sem afetar o anterior.

## 8) Desinstalar

```bash
sudo systemctl disable --now bivvo-docs
sudo rm /etc/systemd/system/bivvo-docs.service
sudo rm /etc/nginx/sites-enabled/bivvo-docs.conf /etc/nginx/sites-available/bivvo-docs.conf
sudo systemctl reload nginx
```

---

### Arquivos deste diretório

| Arquivo | Função |
|---|---|
| `install.sh` | Instalador interativo |
| `schema.sql` | Schema completo do Supabase |
| `.env.example` | Modelo das variáveis de ambiente |
| `nginx.conf.template` | vhost Nginx (proxy_pass para a porta local) |
| `service.template` | Unit systemd |