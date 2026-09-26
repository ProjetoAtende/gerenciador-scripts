# Cloudflare Pong Worker

Servidor autoritativo inicial do Pong multiplayer usando `Cloudflare Workers` + `Durable Objects`.

## Estrutura

- `wrangler.jsonc`: configuracao do Worker e binding do Durable Object
- `src/index.ts`: rota HTTP do Worker e implementacao da sala de partida

## Antes de rodar

Nesta maquina, o `wrangler` tentou usar um diretorio sem permissao para logs e autenticacao.
Para evitar isso, use um `XDG_CONFIG_HOME` dentro desta pasta.

PowerShell:

```powershell
$env:XDG_CONFIG_HOME = "$PWD\\.xdg-config"
```

Se `wrangler whoami` disser que voce nao esta autenticado, refaca o login com esse `XDG_CONFIG_HOME`:

```powershell
$env:XDG_CONFIG_HOME = "$PWD\\.xdg-config"
npx wrangler login
```

## Instalar dependencias

```powershell
npm install
```

## Rodar localmente

```powershell
$env:XDG_CONFIG_HOME = "$PWD\\.xdg-config"
npx wrangler dev
```

## CORS e Origin (dev, hml e prod)

O Worker valida `Origin` para chamadas HTTP e upgrade WebSocket.

- `ALLOWED_ORIGIN`: compatibilidade com configuracao antiga (valor unico)
- `ALLOWED_ORIGINS`: lista CSV de origens permitidas

Exemplo no `wrangler.jsonc`:

```jsonc
"vars": {
	"ALLOWED_ORIGIN": "http://localhost:5173",
	"ALLOWED_ORIGINS": "http://localhost:5173,http://127.0.0.1:5173,https://seu-frontend.exemplo.com"
}
```

Quando `ALLOWED_ORIGINS` estiver preenchida, mantenha nela todas as origens de dev/hml/prod.
Se a origem nao estiver autorizada, o Worker retorna `403 origin_not_allowed`.

## Publicar

```powershell
$env:XDG_CONFIG_HOME = "$PWD\\.xdg-config"
npx wrangler deploy
```

## Secrets esperados

Se voce quiser integrar com Supabase no proprio Worker, configure:

```powershell
$env:XDG_CONFIG_HOME = "$PWD\\.xdg-config"
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

## Endpoints

- `GET /health`
- `GET /matches/:matchId/ws?player=left|right&userId=...`
- `POST /matches/:matchId/start`
- `POST /matches/:matchId/reset`
- `GET /matches/:matchId/state`

## Integracao com frontend (ArenaGamesTab)

O Pong multiplayer agora usa WebSocket autoritativo deste Worker.
Para habilitar no frontend, configure a variavel abaixo no `.env` da aplicacao web:

```env
VITE_PONG_WORKER_URL=https://SEU_WORKER.<subdominio>.workers.dev
```

Exemplo local (quando rodar `wrangler dev`):

```env
VITE_PONG_WORKER_URL=http://127.0.0.1:8787
```

Se essa variavel nao estiver definida, o multiplayer de Ping Pong fica bloqueado (sem fallback para Supabase Realtime).

## Checklist rapido de validacao

1. Suba o Worker (`wrangler dev` ou deploy) e valide `GET /health`.
2. No frontend, configure `VITE_PONG_WORKER_URL` com a URL correta do Worker.
3. Garanta que a URL do frontend esteja em `ALLOWED_ORIGINS`.
4. Teste 2 clientes multiplayer (left/right): conectar, iniciar, pausar, resetar.
5. Se receber `403 origin_not_allowed`, revise `ALLOWED_ORIGINS` e redeploy.

## Modelo de mensagens WebSocket

Cliente para servidor:

```json
{ "type": "input", "direction": -1 }
{ "type": "input", "direction": 0 }
{ "type": "input", "direction": 1 }
{ "type": "start" }
{ "type": "pause" }
{ "type": "reset" }
{ "type": "ping", "clientTs": 1234567890 }
```

Servidor para cliente:

```json
{ "type": "connected", "side": "left", "matchId": "abc", "state": {} }
{ "type": "presence", "players": { "left": true, "right": false } }
{ "type": "state", "state": {}, "serverTs": 1234567890 }
{ "type": "pong", "clientTs": 1234567890, "serverTs": 1234567899 }
```

## Proximos passos recomendados

1. Conectar o frontend do `ArenaGamesTab` a este Worker.
2. Mover a logica atual de host/convidado do cliente para o WebSocket autoritativo.
3. Persistir resultado final da partida no Supabase ao entrar em `gameover`.
