# claude-config

Configuración personal de Claude Code (`~/.claude`), sincronizada como repo privado.

## Uso en un PC nuevo

Si `~/.claude` ya tiene contenido:

```bash
git clone git@github.com:MValles02/claude-config.git /tmp/cc
cp -rn /tmp/cc/. ~/.claude/
```

Si `~/.claude` está vacío, clona directo ahí: `git clone git@github.com:MValles02/claude-config.git ~/.claude`

Luego:

1. Ejecuta `/login` dentro de Claude Code para autenticarte.
2. Corre el script de MCP (registra CodeGraph y Cloudflare): `~/.claude/mcp-setup.sh`, o en Windows:
   ```powershell
   powershell -ExecutionPolicy Bypass -File $HOME\.claude\mcp-setup.ps1
   ```
   Después, en una terminal `claude` interactiva: `/mcp` → `cloudflare` → Authenticate, y abre una sesión nueva. Cloudflare queda a nivel usuario porque un MCP definido dentro de un agente no puede completar OAuth; solo lo usa el agente `cloudflare` (que lo referencia por nombre) y el orquestador lo tiene en `disallowedTools`.
3. Los plugins se instalan a partir de `enabledPlugins` y `extraKnownMarketplaces` en `settings.json`. Si no se instalan solos, usa `/plugin` para agregarlos manualmente.

## Cómo se trabaja

- `settings.json` fija `"agent": "orchestrator"`: cada sesión arranca con el orquestador como líder. Describe el objetivo en lenguaje natural; él elige la ruta (respuesta directa, edición trivial, una tarea de `implementer` o el pipeline completo con `explorer`/`planner`/`implementer`/`verifier`) y los agentes de infra (`vps`, `cloudflare`). Las apps se despliegan con Dokploy en el VPS: `vps` lee estado y logs por SSH, y el orquestador opera la UI de Dokploy (https://dokploy.mateovalles.cloud) en el navegador integrado de la app con tu sesión; confirma cada clic irreversible en el chat y nunca escribe secretos ni variables de entorno. Solo pregunta por decisiones de producto, alcance ambiguo o acciones de riesgo.
- Al terminar un cambio de código en un repo con remoto de GitHub, crea rama, commitea, pushea y abre el PR (el push pide confirmación; nunca mergea). Di "sin commit" o "solo el diff" para evitarlo.
- Para una sesión normal sin orquestador: `claude --agent claude`.
- Hooks: `guard-subagent-git.js` (Bash y PowerShell) tokeniza el comando (wrappers, payloads de `-c`, opciones globales de git) y solo permite una lista de git/`gh` de solo lectura; subcomandos desconocidos y alias cuentan como escrituras, y ante un error de parseo en un sub-agente deniega. Tests en `tests/guard-cases.mjs` (`node tests/guard-cases.mjs`), que corre `ci.yml`. La app de escritorio nombra las sesiones sola.
- Permisos: se niegan las lecturas por shell de `.env*` (salvo `.env.example`), `.credentials.json`, `~/.secrets` y `~/.claude/backups`. Son patrones de texto, de mejor esfuerzo. El modo bypass está deshabilitado.
- Ponytail: `PONYTAIL_DEFAULT_MODE=off` evita que su hook de SessionStart inyecte las reglas en cada sesión; solo `implementer` las carga, con `skills: [ponytail:ponytail]` en su frontmatter.

## PC + VPS

- Claude Code corre en el PC (Windows); los repos viven en `~/code`.
- El VPS se alcanza con `ssh vps` usando el OpenSSH de Windows (`C:/Windows/System32/OpenSSH/ssh.exe`); el `ssh` de Git Bash no ve el agente de Windows.
- Solo el agente `vps` toca el servidor.
- El Claude instalado en el VPS no se usa.
- Docker Desktop corre las bases de datos de desarrollo y los servicios de e2e. Los dev servers se abren con `preview_start` y `.claude/launch.json` de cada repo, visibles en el panel del navegador.

## Herramientas externas

- CodeGraph: `npm i -g @colbymchenry/codegraph@1.6.2`, luego `codegraph telemetry off` y `codegraph init -y` en cada repo de `~/code`, y agrega `.codegraph/` a `~/.config/git/ignore` (el ignore global de git; no viene con este repo). Los worktrees bajo `<repo>/.claude/worktrees` usan el índice del checkout principal; refréscalo con `codegraph sync`. Sin hook `prompt-hook`: inyectaría hasta ~9.000 caracteres en cada prompt; los agentes llaman a `codegraph_explore` cuando lo necesitan.
- Engram v3.2.1: descarga el binario de GitHub releases (verifica el checksum) a un directorio del PATH (en este PC, `~/go/bin`), luego:
  ```bash
  claude plugin marketplace add Gentleman-Programming/engram && claude plugin install engram
  engram setup claude-code   # registra el MCP server (el plugin solo trae hooks); requiere jq y curl
  ```

- TypeScript LSP: `npm i -g typescript-language-server typescript`; el plugin `typescript-lsp` se activa desde `enabledPlugins`. Da diagnósticos tras cada edición y la herramienta `LSP` (definiciones, referencias, tipos).
- Mercado Pago: el plugin `mercadopago` queda en `false` en `enabledPlugins` (sus hooks corren en cada prompt y en casi cada herramienta). Solo se activa en gastar-app, en scope local: desde `~/code/gastar-app`, `claude plugin enable mercadopago@claude-plugins-official --scope local` (queda en su `.claude/settings.local.json`, sin versionar).
- Herramientas del orquestador: usa `disallowedTools` (lista negra), así que hereda todo lo que agregue la app (navegador integrado, conectores de claude.ai, `ccd_*`, ToolSearch). Qué subagentes puede lanzar se controla con `permissions.deny` `Agent(...)` en `settings.json`; Claude in Chrome pide confirmación (`ask`).
- Logins de prueba para los chequeos de UI: el `verifier` usa los usuarios que define cada repo (script de seed o helpers de e2e); no hay archivo de credenciales en `~/.claude`.

## Sincronizar cambios

Como en cualquier repo: rama `chore/...`, commit, PR a `main` (corre gitleaks) y squash merge. Después, `git pull` en `~/.claude`.

## Qué queda excluido a propósito

Credenciales, historial de conversaciones, sesiones, cache y `settings.local.json` nunca se suben (ver `.gitignore`). Las skills locales (`~/.claude/skills`) tampoco se versionan, y `syncClaudeAiSkills: false` evita cargar las skills de la cuenta de claude.ai.
