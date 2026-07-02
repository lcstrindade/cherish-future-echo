# Bivvo Docs — Instalação self-hosted

Central de Ajuda / Documentação com painel admin, editor rico e busca
híbrida. Roda em qualquer VPS Debian/Ubuntu com Nginx + systemd, usando
um Supabase externo (self-hosted ou supabase.com) como backend.

Repositório: <https://github.com/lcstrindade/cherish-future-echo>

---

## Instalação em uma linha

No servidor, como root:

```bash
curl -fsSL https://raw.githubusercontent.com/lcstrindade/cherish-future-echo/main/install/install.sh | sudo bash
```

Isso abre o **painel interativo** do instalador. Ele mostra em tempo real
tudo o que está fazendo e apresenta um menu:

```
  1) Instalar nova instância
  2) Atualizar instância existente
  3) Ver status das instâncias
  4) Reiniciar uma instância
  5) Emitir / renovar SSL
  6) Desinstalar uma instância
  0) Sair
```

O próprio instalador:

- Verifica se rodou como root.
- Clona o repositório em `/opt/bivvo-docs` (perguntará o caminho).
- Instala/atualiza automaticamente o que faltar: `git`, `curl`,
  `nginx`, `openssl`, `iproute2`, **Node.js 20** (via NodeSource) e **Bun**.
- Detecta uma **porta local livre** entre 3000–3999, varrendo tanto
  `ss -tln` quanto todos os `proxy_pass 127.0.0.1:PORT` já configurados
  em `/etc/nginx` — não colide com outros projetos hospedados na mesma
  VPS.
- Coleta interativamente: domínio, **usuário do sistema** (o usuário
  Linux que roda o serviço — padrão `www-data`, **nunca root**),
  credenciais do Supabase (URL, anon key, service_role) e
  usuário/senha do admin do painel.
- Gera `.env` com `chmod 600` e `SESSION_SECRET` aleatório
  (`openssl rand -hex 32`).
- Faz `bun install` + build com `NITRO_PRESET=node-server`.
- Cria um **serviço systemd** próprio (`<slug>.service`) e um **vhost
  Nginx isolado** em `sites-available/<slug>.conf`.
- Roda `nginx -t` antes de qualquer `reload` — se falhar, aborta sem
  derrubar seus outros vhosts.
- Opcionalmente emite SSL Let's Encrypt via `certbot --nginx`.
- Salva o estado da instalação em `/etc/bivvo-docs/<slug>.env` para
  permitir update / restart / desinstalação depois.

### É seguro em VPS que já tem outros projetos?

Sim. O instalador é aditivo: cria arquivos novos, escolhe porta livre,
valida `nginx -t` antes de recarregar, e não edita configs existentes.

---

## Antes do primeiro acesso: preparar o Supabase

1. Crie um projeto Supabase (ou use o seu self-hosted).
2. No **SQL Editor**, cole e rode `install/schema.sql` inteiro. Ele cria
   extensões (`vector`, `pg_trgm`, `unaccent`), as tabelas com RLS +
   GRANTs, a função `search_articles` (busca híbrida), o bucket privado
   `article-media` e um artigo de boas-vindas.
3. Em **Authentication → Users**, crie o usuário admin (email + senha).
4. Ainda no SQL Editor, dê o papel `admin` a esse usuário:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'admin@seudominio.com';
```

5. Em **Project Settings → API**, copie:
   - `Project URL`
   - `anon public` (publishable key)
   - `service_role` (secreto)

Cole esses três valores quando o instalador pedir.

---

## Menu do instalador em detalhe

| Opção | O que faz |
| --- | --- |
| **1 Instalar** | Fluxo completo descrito acima. |
| **2 Atualizar** | Escolhe uma instância registrada, faz `git pull`, `bun install`, rebuild e `systemctl restart`. |
| **3 Status** | Lista as instâncias registradas em `/etc/bivvo-docs/` e mostra quais estão ativas no systemd. |
| **4 Reiniciar** | `systemctl restart <projeto>` + `nginx reload`. |
| **5 SSL** | (Re)emite Let's Encrypt via `certbot --nginx` para o domínio da instância. |
| **6 Desinstalar** | Remove o serviço systemd, o vhost Nginx e o estado; opcionalmente apaga o diretório do app. Dados no Supabase precisam ser removidos manualmente. |

Rodar novamente depois da instalação:

```bash
sudo bash /opt/bivvo-docs/install/install.sh
```

---

## Múltiplas instâncias no mesmo servidor

Rode a opção **1** de novo com outro slug e outro domínio — a detecção
de porta livre garante que cada instância use uma porta diferente e cada
vhost aponte para o serviço correto.

---

## Overrides via variáveis de ambiente

```bash
# Instalar de outra branch/tag:
sudo REPO_BRANCH=v1.2.0 bash -c "$(curl -fsSL https://raw.githubusercontent.com/lcstrindade/cherish-future-echo/main/install/install.sh)"

# Instalar de um fork:
sudo REPO_URL=https://github.com/seu-fork/cherish-future-echo.git bash install/install.sh

# Mudar diretório padrão do clone:
sudo DEFAULT_INSTALL_DIR=/srv/docs bash install/install.sh
```

---

## Estrutura de arquivos

```
install/
  install.sh            # instalador interativo com menu
  schema.sql            # schema completo do Supabase (idempotente)
  nginx.conf.template   # vhost com proxy_pass para 127.0.0.1:PORT
  service.template      # unit systemd
  .env.example          # modelo do .env (gerado automaticamente)
  README.md             # este arquivo
```

Estado salvo em `/etc/bivvo-docs/<slug>.env` (modo 600).
Log da última operação em `/tmp/bivvo-install.log`.

---

## Troubleshooting

| Sintoma | Diagnóstico |
| --- | --- |
| `502 Bad Gateway` | `systemctl status <slug>` e `journalctl -u <slug> -n 100` |
| Build falha | `node -v` deve ser ≥ 20; ver `/tmp/bivvo-install.log` |
| Login admin não funciona | Usuário existe em `auth.users` **e** em `public.user_roles` com role `admin`? |
| Busca vazia | Clique em "Reindexar busca" em `/admin` (requer `LOVABLE_API_KEY`) |
| SSL falhou | Menu → opção **5** depois que o DNS propagar |
| `nginx -t` falhou | Revise `/etc/nginx/sites-available/<slug>.conf` — o instalador **não** recarrega quando o teste falha |