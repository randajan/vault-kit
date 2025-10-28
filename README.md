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

The `id` is passed as the second argument and is optional if `hasMany` is not used.

---

## 🧩 Options

All options are passed into the vault constructor:

```js
import createVault, { Vault } from "@randajan/vault-kit";

const vault = new Vault({ /* options */ }) || createVault({ /* options */ });
```

### General Options

| Option        | Type                      | Description |
|---------------|---------------------------|-------------|
| `hasMany`     | `boolean`                 | Allow multiple IDs or not |
| `readonly`    | `boolean`                 | Prevents all modifications if `true` |
| `remote`      | `object`                  | Remote logic (see below) |
| `ttl`         | `number`                  | Time-to-live in ms for each value |
| `unfold`   | `function` or `string`    | Hook or key for extracting data from the set() result |
| `trait`   | `function`    | Hook for manipulating data before it's stored to vault (set) |
| `emitter`     | `(emit, ctx, ...args) => void` | Custom event dispatcher |

---

## 🔌 Remote Setup

| Key       | Type                            | Description |
|-----------|----------------------------------|-------------|
| `init`    | `(set, forget) => void`          | Passive sync setup |
| `pull`    | `(id, ...args) => Promise<data>` | Called during `get()` |
| `push`    | `(data, id, ...args) => Promise<data>` | Called during `set()` |
| `timeout` | `number`                         | Optional timeout for remote operations (default 5000ms) |
| `preserveAction` | `boolean`                         | If true then the local actions results will be passed as params to the remote. Otherwise you need to specify at local actions result an remote action for example "{ action:"update", params:data }". If actions and remote are defined this will be required. |

If pull or push fails, all pending related operations fail together.

---

## ⚡ Actions

Actions are traits that can help a lot with organize your pushes. At default they are accessible on the local via:

```js
await vault.act.myAction(params, ...args);
```

There is **no need to declare them** on the local. On the remote, define actions:

```js
new Vault({
  actions: {
    myAction: async (params, ctx) => ({ value: 42 })
  },
  unfold: "value"
});
```

This extracts only the `value` from the response for store but client will still receive whole response

---

## 🎯 Behavior

- `readonly: true` blocks both `.set()` and `.act.*`
- `null` / `undefined` values **do not remove** records
- `emitter` lets you **redirect, filter, or rewrite** events
- TTL is **lazy**: entry expires on access, not in background
- `withActions` creates a proxy to call any `vault.act.action()` via property access

---

## ⚙️ API Reference

Same API for single and multi-record usage:

| Method         | Description |
|----------------|-------------|
| `get(id?, ...args)`     | Read local or pull from remote |
| `set(data, id?, ...args)` | Save local and push to remote |
| `act(action, params, ...args)` | Calls an action |
| `reset(id?, ...args)`   | Clears entry and resets state |
| `getStatus(id?)`        | Returns current status |
| `getData(id?)`          | Returns last known value |
| `has(id, ...args)`      | Checks if entry exists |
| `on(fn)`                | Subscribe to all updates |
| `once(fn)`              | Subscribe once to update |
| `forEach(fn)`           | Iterate entries |
| `collect(obj, fn)`      | Iterate and collect into object |

---

## 🧪 Example

```js
const server = new Vault({
  actions: {
    echo: async ({ text }) => ({ message: text + "!" })
  },
  unfold: "message"
});

const client = new Vault({
  ttl:10000,
  remote: {
    pull: id => fetch("/data/" + id).then(r => r.json()),
    push: (data, id) => fetch("/data/" + id, { method: "POST", body: JSON.stringify(data) }),
    timeout: 3000
  },
  unfold: "message"
});

await vault.act.echo({ text: "Hello" }); // returns "Hello!"
```

---

## 📄 License

MIT © [randajan](https://github.com/randajan)
