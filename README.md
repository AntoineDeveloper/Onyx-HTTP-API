# Onyx HTTP API

> REST / JSON bridge for **Obsidian Onyx** lighting software via the Onyx Manager telnet interface.

Onyx HTTP API sits between your applications and Onyx Manager's telnet server. It exposes every telnet command as a clean, documented HTTP endpoint that returns structured JSON — while keeping a persistent, auto-reconnecting telnet connection to minimize latency.

## Features

- **Full REST API** — every Onyx Manager telnet command mapped to a RESTful endpoint
- **Structured JSON** — raw telnet output is parsed into clean JSON objects; the original text is always available in a `raw` field for debugging
- **Persistent telnet connection** — connects once and keeps the socket open; commands execute without the 3–5 s handshake penalty
- **Auto-reconnect** — if the socket drops, it reconnects automatically in the background
- **Interactive API docs** — auto-generated Swagger UI at `/docs`
- **Optional auth** — enable a Bearer token gate with a single env var
- **Verbose logging** — colour-coded, level-gated console output so you always know what's happening
- **Open source** — CUSTOM license, configure everything via `.env`

## Quick Start

```bash
# 1. Clone & install
git clone <repo-url> && cd onyx-http-api
npm install

# 2. Configure
cp .env.example .env
# Edit .env if Onyx Manager is not on localhost:2323

# 3. Make sure Onyx Manager is running with its telnet server on port 2323

# 4. Start the API
npm start
# or, for auto-reload during development:
npm run dev
```

Open **http://localhost:8000/docs** for the interactive Swagger documentation.

## Configuration

All settings live in `.env` (see `.env.example` for defaults):

| Variable | Default | Description |
|---|---|---|
| `TELNET_HOST` | `127.0.0.1` | Onyx Manager telnet host |
| `TELNET_PORT` | `2323` | Onyx Manager telnet port |
| `TELNET_TIMEOUT` | `10` | Seconds before a command times out |
| `TELNET_AUTO_RECONNECT` | `true` | Reconnect on disconnect |
| `TELNET_RECONNECT_INTERVAL` | `5` | Seconds between reconnection attempts |
| `HTTP_PORT` | `8000` | HTTP server port |
| `HTTP_HOST` | `0.0.0.0` | HTTP bind address |
| `AUTH_ENABLED` | `false` | Require Bearer token |
| `AUTH_TOKEN` | *(empty)* | The token to check when auth is enabled |
| `LOG_LEVEL` | `debug` | `debug` / `info` / `warn` / `error` |

## Authentication

Set `AUTH_ENABLED=true` and `AUTH_TOKEN=your-secret` in `.env`.

Every request to `/api/*` must then include:

```
Authorization: Bearer your-secret
```

When disabled, the API is fully open — useful for trusted local networks.

## API Endpoints

### Server
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check + telnet connection status |
| `GET` | `/api/status` | Full Onyx Manager status report |
| `GET` | `/api/whoami` | Your IP as seen by Onyx Manager |
| `GET` | `/api/is-onyx-running` | Check if Onyx is running |

### Cuelists
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/cuelists` | List all cuelists |
| `GET` | `/api/cuelists/active` | List active cuelists |
| `GET` | `/api/cuelists/:id/name` | Get cuelist name |
| `GET` | `/api/cuelists/:id/is-active` | Check if cuelist is active |
| `POST` | `/api/cuelists/:id/go` | Trigger (Go) a cuelist |
| `POST` | `/api/cuelists/:id/go-to/:cue` | Go to a specific cue |
| `POST` | `/api/cuelists/:id/pause` | Pause a cuelist |
| `POST` | `/api/cuelists/:id/release` | Release a cuelist |
| `POST` | `/api/cuelists/:id/level` | Set cuelist level (0–255) |

### Release
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/release-all` | Release all cuelists |
| `POST` | `/api/release-all-dimmer-first` | Release all – dimmer first |
| `POST` | `/api/release-all-overrides` | Release all overrides |
| `POST` | `/api/release-all-cuelists-and-overrides` | Release all cuelists + overrides |
| `POST` | `/api/release-all-cuelists-and-overrides-dimmer-first` | Release all + overrides – dimmer first |

### Programmer
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/clear` | Clear + Clear (clear programmer) |

### Actions
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/actions` | List action groups |
| `GET` | `/api/actions/:id/name` | Get action group name |
| `POST` | `/api/actions/:id/trigger` | Trigger an action group |

### Commands
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/commands` | List all internal commands |
| `GET` | `/api/commands/:id/name` | Get command name |
| `POST` | `/api/commands/:id/execute` | Execute an internal command |

### Schedules
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/schedules` | List schedules |
| `GET` | `/api/schedules/:id/name` | Get schedule name |
| `POST` | `/api/schedules/:id/go` | Activate a schedule |
| `POST` | `/api/schedules/use-calendar` | Return to calendar rules |
| `GET` | `/api/scheduler/is-running` | Check scheduler state |

### Time Presets
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/time-presets` | List time presets |
| `PUT` | `/api/time-presets/:id` | Set a time preset |

### System
| Method | Path | Description |
|---|---|---|
| `PUT` | `/api/system/date` | Set remote date |
| `PUT` | `/api/system/time` | Set remote time |
| `PUT` | `/api/system/position/decimal` | Set geo position (decimal) |
| `PUT` | `/api/system/position/dms` | Set geo position (DMS) |

### Logs
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/logs?lines=20` | Get recent log lines (max 300) |

### Advanced
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/raw` | Send any raw telnet command |

## Response Format

Every response follows this shape:

```json
{
  "data": { ... },
  "raw": "200 Ok\nMxCmd:[0007] RELEASE ALL CUELISTS -"
}
```

- `data` — structured, parsed JSON
- `raw` — the original telnet output for debugging

## License

CUSTOM - VIEW LICENSE.md
