# Bivvo Docs — Instalação self-hosted

Central de Ajuda / Documentação com painel admin, editor rico e busca
híbrida. Roda em qualquer VPS Debian/Ubuntu com Nginx + systemd,
usando um Supabase externo (supabase.com ou self-hosted) como backend.

Repositório: <https://github.com/lcstrindade/cherish-future-echo>

---

## Sobre o login do admin

O login do painel `/auth` **não é** um usuário do Supabase Auth. Ele é
um gate de sessão por cookie, validado no servidor contra duas
variáveis de ambiente do próprio app:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

Essas duas variáveis são definidas no `.env` da VPS (o instalador
pergunta e grava com `chmod 600`). Todas as escritas no banco são
feitas por server functions usando a `service_role` do Supabase, que
ignora RLS — por isso não é preciso criar usuário/role no Supabase
para o admin funcionar.

Para trocar a senha do admin depois, edite o `.env` da instância e
reinicie o serviço (menu → opção **4 Reiniciar**), ou rode o menu do
instalador → opção **2 Atualizar**.

---

## Etapa 1 — Preparar o Supabase (fazer ANTES do instalador)

1. Crie um projeto em <https://supabase.com> (ou use seu Supabase
   self-hosted).
2. Abra **SQL Editor → New query**, cole o conteúdo inteiro de
   `install/schema.sql` e rode. Isso cria:
   - extensões `vector`, `pg_trgm`, `unaccent`;
   - tabelas `articles` e `user_roles` com RLS + GRANTs;
   - função `search_articles` (busca híbrida FTS + vetor + trigram);
   - bucket privado `article-media` com policies;
   - um artigo de boas-vindas.
3. Em **Project Settings → API**, copie estes três valores — o
   instalador vai pedir todos:
   - **Project URL** (ex.: `https://xxxx.supabase.co`)
   - **anon public** key
   - **service_role** key (secreta, nunca exponha no front)

Pronto. Você **não** precisa criar usuário em Authentication → Users
para o admin (veja a seção acima).

---

## Etapa 2 — Rodar o instalador na VPS

No servidor, como root:

```bash
curl -fsSL https://raw.githubusercontent.com/lcstrindade/cherish-future-echo/main/install/install.sh | sudo bash
```

O painel interativo mostra em tempo real tudo o que faz e apresenta o
menu:

```
  1) Instalar nova instância
  2) Atualizar instância existente
  3) Ver status das instâncias
  4) Reiniciar uma instância
  5) Emitir / renovar SSL
  6) Desinstalar uma instância
  0) Sair
```

Ao escolher **1 Instalar**, o instalador:

- Verifica se rodou como root.
- Clona o repositório em `/opt/bivvo-docs` (perguntará o caminho).
- Instala/atualiza automaticamente o que faltar: `git`, `curl`,
  `nginx`, `openssl`, `iproute2`, **Node.js 20** (via NodeSource) e
  **Bun**. Se o Nginx já existir, ele é reaproveitado — nada é
  reinstalado nem sobrescrito.
- Detecta uma **porta local livre** entre 3000–3999, varrendo
  `ss -tln` e todos os `proxy_pass 127.0.0.1:PORT` já presentes em
  `/etc/nginx`, então nunca colide com outros projetos da mesma VPS.
- Coleta interativamente:
  - domínio (ex.: `docs.seudominio.com`);
  - **usuário do sistema** — o usuário Linux dono do processo
    (padrão `www-data`; **nunca use root**);
  - credenciais do Supabase da Etapa 1 (URL, anon, service_role);
  - `ADMIN_USERNAME` e `ADMIN_PASSWORD` do painel.
- Gera o `.env` com `chmod 600` e cria `SESSION_SECRET` aleatório
  (`openssl rand -hex 32`).
- Roda `bun install` + build (`NITRO_PRESET=node-server`).
- Cria um **serviço systemd** próprio (`<slug>.service`) e um
  **vhost Nginx isolado** em `sites-available/<slug>.conf`.
- Valida com `nginx -t` antes de qualquer `reload` — se falhar,
  aborta sem derrubar seus outros vhosts.
- Opcionalmente emite SSL Let's Encrypt via `certbot --nginx`.
- Salva o estado em `/etc/bivvo-docs/<slug>.env` para permitir
  update / restart / SSL / desinstalação depois pelo mesmo menu.

### É seguro em VPS que já tem outros projetos?

Sim. O instalador é aditivo: cria arquivos novos, escolhe porta livre,
valida `nginx -t` antes de recarregar e não edita configs existentes.

---

## Menu do instalador em detalhe

| Opção | O que faz |
| --- | --- |
| **1 Instalar** | Fluxo completo descrito acima. |
| **2 Atualizar** | Escolhe uma instância registrada, faz `git pull`, `bun install`, rebuild e `systemctl restart`. |
| **3 Status** | Lista instâncias em `/etc/bivvo-docs/` e mostra quais estão ativas no systemd. |
| **4 Reiniciar** | `systemctl restart <slug>` + `nginx reload`. |
| **5 SSL** | (Re)emite Let's Encrypt via `certbot --nginx` para o domínio da instância. |
| **6 Desinstalar** | Remove serviço systemd, vhost Nginx e estado; opcionalmente apaga o diretório. Dados no Supabase são preservados. |

Reabrir o menu depois:

```bash
sudo bash /opt/bivvo-docs/install/install.sh
```

---

## Múltiplas instâncias no mesmo servidor

Rode a opção **1** de novo com outro slug e outro domínio. A detecção
de porta livre garante que cada instância use uma porta diferente e
cada vhost aponte para o serviço correto.

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
| Login admin não entra | Confira `ADMIN_USERNAME` / `ADMIN_PASSWORD` no `.env` da instância e reinicie (menu → **4**) |
| Busca vazia | Clique em "Reindexar busca" em `/admin` |
| SSL falhou | Menu → opção **5** depois que o DNS propagar |
| `nginx -t` falhou | Revise `/etc/nginx/sites-available/<slug>.conf` — o instalador **não** recarrega quando o teste falha |