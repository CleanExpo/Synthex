# pixel-office-tailscale

One [Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents) office that shows the Claude
Code agents running on **every** computer in a Tailscale tailnet, not just the one you are sitting
at. No fork of pixel-agents is needed — this runs alongside it and uses only its published on-disk
and HTTP contracts.

## Why it needs anything at all

Pixel Agents is loopback-only by construction, in two places:

1. `claude-hook.js` posts every hook event to a **hardcoded `127.0.0.1`**
   (`server/src/providers/hook/claude/hooks/claude-hook.ts`). It has no host field to set.
2. It only posts to a registry entry under `~/.pixel-agents/servers/` whose **PID is alive on this
   machine**. A remote server's PID means nothing locally, so you cannot simply write the hub's
   port into a satellite's registry.

So a satellite needs a real local process that the hook can dial. That is what the **relay** is.

```
  Mac mini                                          Windows desktop (hub)
  ─────────                                         ─────────────────────
  claude-hook.js ──POST──▶ relay (127.0.0.1:4321) ──▶ pixel-agents office (0.0.0.0:4319)
       │                        │        Tailscale         ▲
       │                        └────────WireGuard─────────┘
       └── registered in ~/.pixel-agents/servers/tailscale-relay.json
           with the RELAY's own pid, so the liveness rule is satisfied honestly
```

## What the relay changes on the way through

Two edits per event, both required:

- **`transcript_path` is removed.** pixel-agents branches on it. With a path it adopts the session
  by opening that JSONL file and watching it; the path names a file on the satellite that the hub
  cannot see, so the character would appear and never move. Without a path it takes the
  **hooks-only** branch and drives the character purely from hook events, which is what works over
  a network.
- **`cwd` gets `@<machine>` appended to its last segment.** The hub labels each character from
  `path.basename(cwd)`, so this is what makes a Mac agent read `synthex@unite-mac-mini`. It also
  gives each machine a distinct `projectDir`, so office **Areas** can be mapped per machine.

Agents on the hub itself are **not** tagged — they reach the office directly through the normal
local registry and never pass through a relay. Untagged therefore means "this machine".

## Setup

### On the hub — the computer whose screen shows the office

```bash
node bin/pixel-office.mjs init-hub --machine phill-desktop
node bin/pixel-office.mjs hub
```

`init-hub` mints a **pair key** and prints the exact two commands to run on every other computer.
`hub` starts `npx pixel-agents --host 0.0.0.0 --port 4319` (restarting it if it dies) and a small
pairing endpoint on port 4320.

The pairing endpoint exists because pixel-agents mints a **fresh office token on every start**
(`crypto.randomUUID()` in `server/src/server.ts`). A satellite that pinned that token would break
on the hub's next restart. Instead each satellite holds a stable pair key and trades it for
whatever the current office token is — a hub restart costs one failed POST, not a manual re-pair.

### On every other computer

```bash
node bin/pixel-office.mjs init-relay --hub <hub-tailscale-name> --key <pair-key>
node bin/pixel-office.mjs install-hooks --script /path/to/claude-hook.js
node bin/pixel-office.mjs relay
```

`--script` is only needed the first time on a machine that has never run pixel-agents: it copies a
known-good `claude-hook.js` into `~/.pixel-agents/hooks/`. Copy it from the hub
(`~/.pixel-agents/hooks/claude-hook.js`), or drop the flag once pixel-agents has run there once.

`install-hooks` writes entries into `~/.claude/settings.json` that are byte-identical to the ones
pixel-agents writes itself, so its own uninstall recognises them. It is merge-safe (existing hooks
on the same event are kept), it takes a one-time `.pixel-office-backup` copy first, and it refuses
to touch a settings file it cannot parse. `uninstall-hooks` removes only its own commands.

### Keep it running

```bash
node bin/pixel-office.mjs install-service     # launchd / Task Scheduler / systemd --user
```

Not automatic: a login item is standing configuration on someone's computer, so it is always an
explicit command. Without it, a reboot silently stops that machine reporting — the office keeps
showing its last known agents with nothing saying the feed went quiet.

## Checking it

```bash
node bin/pixel-office.mjs status          # role, hooks, autostart, live servers, whole tailnet
curl http://127.0.0.1:4321/__relay/health # forwarded / dropped / repairs, on a satellite
```

`status` lists offline tailnet nodes too. "Three computers in operation" is a claim about the
tailnet, and a machine that has been dark for months should show as dark rather than be quietly
dropped from a count.

## Security

- The office and the pairing endpoint bind `0.0.0.0`, reachable over the tailnet. The gates are
  Tailscale itself plus, on `/pair`, a 256-bit pre-shared key compared in constant time.
- The relay binds **127.0.0.1 only**. Nothing off the satellite can inject events into the tailnet
  through it.
- The pair key is written to `~/.pixel-office-tailscale.json` with mode 0600. It is a credential;
  move it over the tailnet or a password manager, not a chat window.
- Delivery is best-effort and never blocks the agent: the relay answers the hook immediately and
  forwards in the background, because Claude Code kills a hook at 5 seconds. Drops are counted at
  `/__relay/health`, not raised.

## Tested against

pixel-agents v1.4.1 (`3537e14`). The registry protocol version, hook API path, hook event list and
settings entry shape are pinned in `src/constants.mjs`. If a future release bumps the registry
protocol, `/pair` refuses rather than posting into the void.

```bash
node --test test/relay.test.mjs test/hooks.test.mjs
```
