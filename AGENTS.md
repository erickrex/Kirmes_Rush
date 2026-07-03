# Agent Guidance

## IMPORTANT: Environment & tooling

This project lives on a WSL (Ubuntu-22.04) filesystem, but Kiro runs on Windows. Shell
commands execute inside WSL bash even though the host reports `cmd`/`win32`. Read this
before running any command.

- **Ignore `Exit Code: -1`.** The Windows↔WSL bridge cannot read the real exit status, so
  it always reports `-1` and leaks the bash prompt into output. `-1` does NOT mean failure.
  Judge success by the actual command output or by inspecting artifacts (e.g. `dist/`).

- **Do NOT use `npm`.** In this WSL setup `npm` resolves to the broken Windows install
  (`/mnt/c/Program Files/nodejs/npm`) and crashes. The nvm node ships no npm — only
  `corepack`, `pnpm`, and `yarn`. **Use `pnpm`** for all package operations
  (`pnpm install`, `pnpm dev`, `pnpm build`, `pnpm test`).

- **Set PATH first.** `pnpm`/`node` are not on the default PATH used by the bridge. Prefix
  commands with:
  ```bash
  export PATH="/home/rexbox/.nvm/versions/node/v20.19.6/bin:$PATH"
  ```

- **Long-running commands (dev server, watchers) use the background-process tool**, not a
  blocking shell call. Start the dev server with:
  ```bash
  export PATH="/home/rexbox/.nvm/versions/node/v20.19.6/bin:$PATH"; node_modules/.bin/vite --host
  ```
  It serves at http://localhost:3000/ (WSL2 forwards localhost to the Windows browser).

- **Finite verification** (safe to run in a normal shell call): `pnpm build`, `pnpm test`,
  `pnpm run lint`, `pnpm run typecheck`.
