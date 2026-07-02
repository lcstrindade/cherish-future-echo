# Bivvo Docs — Instalação self-hosted

Central de Ajuda / Documentação com painel admin, editor rico, upload de mídia e busca inteligente. Roda em VPS Debian/Ubuntu com Nginx + systemd e usa um Supabase externo como banco/storage.

Repositório: <https://github.com/lcstrindade/cherish-future-echo>

---

## Entendendo o login do admin

O painel `/auth` **não usa usuário criado no Supabase Auth**.

Ele é um login simples do próprio sistema, validado no servidor por variáveis no `.env` da VPS:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

Agora o instalador define isso automaticamente:

- usuário padrão: `admin`
- senha: gerada automaticamente com valor forte e aleatório

No final da instalação, o instalador **não imprime a senha no terminal**. Ele salva uma cópia em:

```bash
/etc/bivvo-docs/<slug>-admin.txt
```

Esse arquivo fica com permissão `600`, acessível apenas pelo root. Para consultar a senha inicial, use `sudo cat /etc/bivvo-docs/<slug>-admin.txt`. Para trocar depois, edite o `.env` da instância e reinicie pelo menu do instalador.

> Resumo: no Supabase você prepara banco/storage. O usuário e senha do painel são do app e o instalador já cria automaticamente.

---

## Etapa 1 — Preparar o Supabase externo

Faça isso antes de rodar o instalador na VPS.

### 1. Criar o projeto

Crie um projeto no Supabase Cloud ou no seu Supabase self-hosted.

### 2. Rodar o schema

No SQL Editor do Supabase, cole e execute o conteúdo completo de:

```bash
install/schema.sql
```

Esse arquivo cria/configura:

- extensões `vector`, `pg_trgm` e `unaccent`;
- tabela `articles`;
- tabela `user_roles`;
- políticas RLS e `GRANTs` necessários;
- função `search_articles` para busca híbrida;
- bucket privado `article-media`;
- artigo inicial de teste/boas-vindas.

### 3. Separar as credenciais do Supabase

Você precisará informar ao instalador:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` / `anon public key`
- `SUPABASE_SERVICE_ROLE_KEY`

Guarde a `service_role` com cuidado. Ela é secreta e nunca deve ir para o frontend ou para um repositório público.

### 4. Verificar antes de seguir

Antes da VPS, confirme que você tem:

- domínio apontado para o IP da VPS;
- credenciais do Supabase externo;
- acesso root/sudo à VPS;
- porta 80 liberada para Nginx;
- porta 443 liberada se for emitir SSL.

---

## Etapa 2 — Rodar o autoinstalador na VPS

No servidor, rode:

```bash
curl -fsSL https://raw.githubusercontent.com/lcstrindade/cherish-future-echo/main/install/install.sh | sudo bash
```

Se estiver rodando a partir de um clone local:

```bash
sudo bash install/install.sh
```

O instalador abre um menu interativo:

```text
1) Instalar nova instância
2) Atualizar instância existente
3) Ver status das instâncias
4) Reiniciar uma instância
5) Emitir / renovar SSL
6) Desinstalar uma instância
0) Sair
```

Escolha **1 — Instalar nova instância**.

---

## O que o instalador faz automaticamente

Durante a instalação ele:

- clona o repositório em `/opt/bivvo-docs` ou no diretório escolhido;
- instala/atualiza dependências necessárias: `git`, `curl`, `nginx`, `openssl`, `iproute2`, Node.js 20 e Bun;
- reaproveita o Nginx existente, se já estiver instalado;
- detecta porta local livre entre `3000` e `3999`, evitando conflito com outros projetos;
- pergunta o domínio da instância;
- pergunta o usuário Linux que executará o serviço, com padrão `www-data`;
- pergunta as credenciais do Supabase externo;
- gera automaticamente `ADMIN_USERNAME=admin` e uma senha forte para o painel;
- gera `SESSION_SECRET` automaticamente;
- cria `.env` com permissão `600`;
- executa `bun install` e build de produção;
- cria um serviço systemd isolado;
- cria um vhost Nginx isolado;
- valida `nginx -t` antes de recarregar o Nginx;
- opcionalmente emite SSL com Let's Encrypt;
- salva o estado da instância em `/etc/bivvo-docs/`.

---

## Campos solicitados na instalação

| Campo | O que é |
| --- | --- |
| Nome do projeto | Slug interno da instância, ex.: `bivvo-docs` |
| Domínio público | Domínio que abrirá a documentação, ex.: `docs.seudominio.com.br` |
| Usuário do sistema | Usuário Linux que executa o app, padrão `www-data`; não use `root` |
| `SUPABASE_URL` | URL do Supabase externo |
| `SUPABASE_PUBLISHABLE_KEY` | Chave pública/anon do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave secreta usada apenas no servidor |

O instalador **não pergunta mais** `ADMIN_USERNAME` e `ADMIN_PASSWORD`, porque cria os dois automaticamente.

---

## Após instalar

O final da instalação mostrará algo como:

```text
URL          : https://docs.seudominio.com.br
Admin login  : https://docs.seudominio.com.br/auth  (usuário: admin)
Senha admin  : salva em /etc/bivvo-docs/bivvo-docs-admin.txt
```

Para ver novamente a senha inicial:

```bash
sudo cat /etc/bivvo-docs/<slug>-admin.txt
```

Para trocar o usuário/senha depois:

```bash
sudo nano /opt/bivvo-docs/.env
sudo bash /opt/bivvo-docs/install/install.sh
```

No menu, escolha **4 — Reiniciar uma instância**.

---

## Segurança e projetos já existentes

O instalador foi feito para VPS com outros projetos rodando.

Ele é aditivo e isolado:

- não sobrescreve vhosts existentes;
- não remove projetos existentes;
- não usa porta já ocupada;
- cria serviço systemd próprio;
- cria arquivo Nginx próprio;
- roda `nginx -t` antes de reload;
- se o teste do Nginx falhar, ele aborta sem aplicar reload.

---

## Atualizar, reiniciar, SSL e remover

Reabra o menu:

```bash
sudo bash /opt/bivvo-docs/install/install.sh
```

| Opção | O que faz |
| --- | --- |
| 1 | Instala nova instância |
| 2 | Atualiza código, dependências, build e reinicia |
| 3 | Mostra status das instâncias |
| 4 | Reinicia serviço e Nginx |
| 5 | Emite/renova SSL |
| 6 | Remove serviço, vhost e estado da instância |

A remoção não apaga os dados no Supabase externo.

---

## Múltiplas instâncias

Você pode rodar a opção **1** novamente com outro slug e outro domínio. O instalador escolherá outra porta local livre e criará outro serviço/vhost isolado.

---

## Variáveis avançadas

```bash
# Instalar de outra branch/tag
sudo REPO_BRANCH=v1.2.0 bash -c "$(curl -fsSL https://raw.githubusercontent.com/lcstrindade/cherish-future-echo/main/install/install.sh)"

# Instalar de um fork
sudo REPO_URL=https://github.com/seu-fork/cherish-future-echo.git bash install/install.sh

# Mudar diretório padrão
sudo DEFAULT_INSTALL_DIR=/srv/docs bash install/install.sh

# Forçar credenciais admin específicas, se realmente quiser
sudo ADMIN_USERNAME=meuadmin ADMIN_PASSWORD='senha-forte-aqui' bash install/install.sh
```

---

## Estrutura da pasta `install/`

```text
install/
  install.sh            # autoinstalador interativo
  schema.sql            # schema completo do Supabase externo
  nginx.conf.template   # vhost Nginx
  service.template      # serviço systemd
  .env.example          # referência de variáveis
  README.md             # este guia
```

---

## Troubleshooting

| Sintoma | O que verificar |
| --- | --- |
| `502 Bad Gateway` | `systemctl status <slug>` e `journalctl -u <slug> -n 100` |
| Build falhou | Ver `/tmp/bivvo-install.log`; confirmar Node.js 20+ |
| Login admin não entra | Ver `/etc/bivvo-docs/<slug>-admin.txt`; se alterou `.env`, reinicie |
| Busca vazia | Acesse `/admin` e use a opção de reindexar busca |
| SSL falhou | Aguarde DNS propagar e rode menu → opção 5 |
| `nginx -t` falhou | Revise `/etc/nginx/sites-available/<slug>.conf`; o instalador não recarrega se o teste falhar |