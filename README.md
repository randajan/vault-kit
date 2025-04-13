
# @randajan/vault-kit

[![NPM](https://img.shields.io/npm/v/@randajan/vault-kit.svg)](https://www.npmjs.com/package/@randajan/vault-kit) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)


## 🧬 Universal Glue for your Data Flow
vault-kit is an ultra-lightweight, event-driven sync layer between any data producer and data consumer.
Think of it as programmable glue — seamless, flexible, and fast.

- 🧠 System-agnostic – Works in Node.js, browsers, or anywhere JavaScript runs.
- 📦 Dual-format ready – Distributed as both CommonJS (CJS) and ECMAScript Modules (ESM).
- 🔌 Backend-agnostic – Easily plugs into REST, WebSocket, GraphQL, localStorage, memory, custom APIs, and more.
- 🛠️ Fully modular – Bring your own transport logic. Don't like assumptions? Perfect.
- 🔁 3-way sync – From local to remote, remote to local, and passive remote-driven updates.
- 🧩 Composable – Chainable, embeddable, stackable. Use one or many.
- 🌀 Cache + Sync – Transparent in-memory caching with lazy fetch and optimistic write.
- 💡 Minimal, but mighty – No dependencies. Pure logic. Easy to read. Easy to extend.
- 🚀 Perfect for real-time apps – Ideal with socket.io, signals, or any reactive system.

Use it to orchestrate state, power form sync, or bridge the gap between local UI and remote data.
Vault is your contractless API. A wire that listens. A sync pulse.

---

## ✨ Purpose

It acts like a **virtual file system** where each file is identified by an `id`. It supports:

- **Local to Remote** updates (`vault.set → remote.push`)
- **Remote to Local** updates (`remote.pull → vault.get`)
- **Passive Sync** (via `remote.init`)
- **Events** triggered on any change
- **Automatic Caching** of the last known state

You can choose between:

- `VaultOne`: handles a single (unnamed) unit of data
- `VaultMany`: handles multiple entries identified by `id`

To illustrate, VaultMany is used on the server to store context and create an interface for multiple clients. The clients then use VaultOne.

---

## 🧩 Options

All options are passed into the vault constructor. Use the default export:

```js
import createVault from "@randajan/vault-kit";

const vault = createVault({ /* options */ });
```

### General Options

| Option        | Type                      | Description |
|---------------|---------------------------|-------------|
| `hasMany`     | `boolean`                 | `true` = `VaultMany`, `false` = `VaultOne` |
| `name`        | `string`                  | Optional name for debugging/errors |
| `readonly`    | `boolean`                 | Prevents local writes if `true` |
| `remote`      | `object`                  | Remote logic (see below) |
| `onRequest`   | `function`                | Hook before local sets (`setReady`) |
| `onResponse`  | `function`                | Hook after remote pushes (`push`) |
| `emitter`     | `(emit, ctx, ...args) => void` | Hook into all events, override default emitter |

---

## 🔌 Remote Setup

Remote logic is fully optional and modular.

| Key       | Type                        | Arguments                            | Return                     | Description |
|-----------|-----------------------------|--------------------------------------|----------------------------|-------------|
| `init`    | `(set:Fn) => void`          | Called once on creation             | `void`                     | Bind incoming remote events |
| `pull`    | `(id, ...args) => data`     | On `vault.get()`                     | `Promise<data>`            | Fetch remote data |
| `push`    | `(data, id, ...args) => data` | On `vault.set()`                    | `Promise<data>`            | Push data to remote |

If `remote` is defined and `readonly` isn't set, `vault.set()` will use `push`.  
If `remote.pull` is defined, missing or stale values will be pulled via `get()`.

---

## 🧠 Hook Functions (options)

### onRequest(data, id, ...args) → `[data, result]`

Invoked before any local write. Can be used to transform or validate data.

### onResponse(data, id, ...args) → `[data, result]`

Invoked after `push()`. Can be used to analyze or update data before it reaches the local store.

### emitter(emit, ctx, ...args)

Override the default event system. Only called on status changes.

- `emit`: call to emit an event
- `ctx`: `{ id, status, to, from }`
- `...args`: custom args passed into all methods

> Vault uses `emit(ctx, ...args)` unless you override it.

---

## ⚙️ API Reference

All methods accept extra `...args` which propagate to all hooks (`onRequest`, `onResponse`, `remote`, `emitter`).

### Common Methods (Vault, VaultOne, VaultMany)

| Method       | Description |
|--------------|-------------|
| `get(id?, ...args)`     | Fetch value. Pulls from remote if missing or stale |
| `set(data, id?, ...args)` | Write value. Sends to remote if available |
| `reset(id?)`            | Deletes the entry |
| `getData(id?)`          | Gets last known value (`undefined` if never set) |
| `getStatus(id?)`        | Returns current status: `init`, `pull`, `push`, `ready`, `error` |
| `on(fn)`                | Subscribes to all events. `fn(ctx, ...args)` |
| `once(fn)`              | Subscribes only once. Same format as `on` |

> `VaultOne` omits the `id` argument internally, i.e. `vault.get(...args)`.

### VaultMany Specific

| Method          | Description |
|-----------------|-------------|
| `has(id, ...args)` | Returns `true` if the entry exists (resolved value is not `undefined`) |
| `forEach(fn)`   | Iterates over all local entries. Supports async `fn(ctx)` |
| `collect(collector, fn)` | Like `forEach`, but passes collector object for accumulation |

---

## 🔄 Status Lifecycle

Each entry goes through statuses:

- `init`: fresh
- `pull`: being fetched
- `push`: being saved
- `ready`: valid
- `error`: failed

You can listen to status changes via `on()` or `once()`.

---

## 🧪 Example

```js
import { VaultMany } from "@randajan/vault-kit";

const vault = new VaultMany({
  remote: {
    pull: async id => fetchData(id),
    push: async (data, id) => saveData(id, data),
    init: set => socket.on("update", ([id, data]) => set(data, id))
  },
  onRequest: async (data, id) => [sanitize(data), { ok: true }],
  onResponse: async (data, id) => [data, { received: true }],
  emitter: (emit, ctx, ...args) => {
    if (ctx.status === "ready") emit(ctx, ...args);
  }
});

await vault.set({ foo: 1 }, "myKey");
const result = await vault.get("myKey");
```

---

## 🙏 Thanks

Thanks for using `@randajan/vault-kit`!  
Good luck, and feel free to send issues, suggestions, or ideas for improvements.  
We appreciate every kind of feedback ❤️
