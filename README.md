# @randajan/vault-kit

[![NPM](https://img.shields.io/npm/v/@randajan/vault-kit.svg)](https://www.npmjs.com/package/@randajan/vault-kit)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

A tiny event-driven data vault for local cache, remote sync, actions, and passive updates.

`vault-kit` gives you one small primitive that can behave like a single cached value or a multi-record store. You provide the transport: REST, WebSocket, localStorage, IndexedDB, memory, GraphQL, custom APIs, anything that returns data.

## Features

- Single-value or multi-record mode with the same API.
- Local cache with status tracking.
- Lazy remote `pull()` on first read or after reset/expiry.
- Remote `push()` on local writes.
- Passive remote-to-local sync through `remote.init()`.
- Action proxy via `vault.act.someAction(params)`.
- `ttl` support with cleanup that does not keep Node.js alive.
- Remote operation timeouts powered by `@randajan/sleep`.
- React hook export at `@randajan/vault-kit/react`.

## Install

```bash
npm install @randajan/vault-kit
```

## Quick Start

```js
import createVault from "@randajan/vault-kit";

const notes = createVault({
    hasMany:true,
    ttl:10000,
    remote:{
        timeout:3000,
        pull:id=>fetch(`/api/notes/${id}`).then(res=>res.json()),
        push:(data, id)=>fetch(`/api/notes/${id}`, {
            method:"PUT",
            headers:{ "content-type":"application/json" },
            body:JSON.stringify(data)
        }).then(res=>res.json())
    }
});

notes.on((ctx, id)=>{
    console.log(ctx.status, id, ctx.data);
});

const note = await notes.get("welcome");
await notes.set({ ...note, title:"Hello" }, "welcome");
```

## Core Model

A vault stores cells. In the default mode there is one cell:

```js
const user = createVault();

await user.set({ name:"Ada" });
console.log(await user.get());
```

With `hasMany:true`, each cell is addressed by the first non-data argument:

```js
const users = createVault({ hasMany:true });

await users.set({ name:"Ada" }, "ada");
await users.set({ name:"Grace" }, "grace");

console.log(await users.get("ada"));
```

Each cell has one of these statuses:

| Status | Meaning |
|--------|---------|
| `init` | Empty or reset. |
| `pull` | Waiting for `remote.pull()`. |
| `push` | Waiting for `remote.push()`. |
| `ready` | Data is available. |
| `error` | Last pull, push, action, trait, or purge failed. |
| `expired` | TTL expired and the cell was reset. |
| `destroyed` | Vault was destroyed and cannot be used again. |

## Options

```js
import createVault, { Vault } from "@randajan/vault-kit";

const vault = createVault(options);
const same = new Vault(options);
```

| Option | Type | Description |
|--------|------|-------------|
| `hasMany` | `boolean` | Enables multiple IDs. Defaults to `false`. |
| `readonly` | `boolean` | Blocks `set()` and `act.*()`. |
| `remote` | `object` | Remote pull/push/init/destroy behavior. |
| `ttl` | `number` | Time-to-live in ms. `0` disables expiry. |
| `actions` | `object` | Local action handlers used by `act()`. |
| `actionsCatch` | `(error) => data` | Converts action errors into fallback data. |
| `unfold` | `function` or `string` | Extracts stored data from a result. |
| `trait` | `(data, result) => data` | Transforms data before it is stored. |
| `purge` | `(oldData) => void` | Runs before old data is discarded. |
| `emitter` | `(emit, ctx, ...args) => void` | Filters, delays, rewrites, or forwards events. |

### Remote

| Remote option | Type | Description |
|---------------|------|-------------|
| `pull` | `(...args) => data \| Promise<data>` | Required when `remote` is used. Called by `get()`. |
| `push` | `(data, ...args) => data \| Promise<data>` | Called by `set()` and `act.*()`. If missing, the vault is readonly. |
| `init` | `(set) => cleanup` | Optional passive-sync setup. Call `set(data, ...args)` to inject remote updates. |
| `destroy` | `(initReturn) => void` | Optional cleanup. Receives the return value from `init()`. |
| `timeout` | `number` | Remote timeout in ms. Defaults to `5000`; `0` disables timeout wrapping. |
| `preserveAction` | `boolean` | Required when local `actions` and `remote` are both provided. Controls whether local action output is wrapped back into `{ action, params }`. |

Remote timeouts use `@randajan/sleep.withTimeout()`. Its internal timer is cleaned up when the remote promise settles and uses unref behavior in Node.js, so a pending timeout timer does not keep a process alive by itself.

## Actions

`act()` sends an `{ action, params }` request through the same write pipeline as `set()`.

```js
await vault.act("increment", { by:1 });
await vault.act.increment({ by:1 });
```

You can let the remote side interpret the action request:

```js
const client = createVault({
    remote:{
        pull:id=>api.get(id),
        push:(request, id)=>api.action(id, request.action, request.params)
    }
});

await client.act.rename({ title:"New title" }, "note-1");
```

Or define local actions that convert user intent into data before push:

```js
const vault = createVault({
    actions:{
        rename:({ title })=>({ title })
    },
    remote:{
        preserveAction:false,
        pull:id=>api.get(id),
        push:(data, id)=>api.save(id, data)
    }
});

await vault.act.rename({ title:"New title" }, "note-1");
```

Use `actionsCatch` when action errors should become data instead of thrown errors:

```js
const vault = createVault({
    actions:{
        save:data=>{
            if (!data.title) { throw new Error("Missing title"); }
            return data;
        }
    },
    actionsCatch:error=>({ error:true, message:error.message })
});
```

## Transforming Results

`unfold` extracts the value stored in the vault from a larger result. The original result is still returned to the caller.

```js
const vault = createVault({
    unfold:"record"
});

const reply = await vault.set({ record:{ title:"Saved" }, meta:{ ok:true } });

console.log(vault.getData()); // { title:"Saved" }
console.log(reply);           // { record:{...}, meta:{ ok:true } }
```

`trait` runs after `unfold` and before the value is stored:

```js
const vault = createVault({
    trait:data=>({ ...data, cachedAt:Date.now() })
});
```

`purge` runs before old data is discarded by `set()`, `reset()`, expiry, or `destroy()`.

## Events

Subscribe with `on()` or `once()`:

```js
const off = vault.on((ctx, id)=>{
    console.log(ctx.status, id, ctx.data, ctx.error);
});

off();
```

The event context has:

| Field | Description |
|-------|-------------|
| `status` | New status. |
| `data` | Current data, when available. |
| `error` | Current error, when available. |
| `before` | Previous `{ status, data }` snapshot. |

`emitter` wraps event dispatch:

```js
const vault = createVault({
    emitter:(emit, ctx, ...args)=>{
        if (ctx.status === "ready") { emit(ctx, ...args); }
    }
});
```

## TTL And Destroy

`ttl` marks non-persistent values for expiry. Expired cells reset to `expired` when they are accessed. When `ttl` is enabled, vault-kit also creates a cleanup interval at `ttl / 2`; in Node.js this interval is `unref()`'d and it is always cleared by `destroy()`.

```js
const vault = createVault({ ttl:5000 });

await vault.set({ value:1 });

setTimeout(()=>console.log(vault.getStatus()), 6000); // expired
```

`destroy()` resets all cells to `destroyed`, clears internal cleanup, calls remote cleanup, and makes future access invalid.

## API

| Method | Description |
|--------|-------------|
| `get(...args)` | Returns cached data or starts `remote.pull()`. |
| `set(data, ...args)` | Stores local data or pushes to remote. |
| `act(action, params, ...args)` | Runs an action through the write pipeline. |
| `act.name(params, ...args)` | Proxy shorthand for `act("name", params, ...args)`. |
| `getStatus(...args)` | Returns the current status. |
| `getData(...args)` | Returns cached data without pulling. |
| `getError(...args)` | Returns the current error. |
| `isStatus(statusOrList, ...args)` | Checks the current status. |
| `has(...args)` | Resolves to `true` when `get()` returns a non-`undefined` value. |
| `reset(...args)` | Resets one cell to `init`. |
| `resetAll(...args)` | Resets every cell to `init`. |
| `destroy(...args)` | Resets every cell to `destroyed` and runs cleanup. |
| `on(fn)` | Subscribes to events. Returns an unsubscribe function. |
| `once(fn)` | Subscribes to the next event only. |
| `forEach(fn)` | Iterates cached cells. |
| `collect(object, fn)` | Iterates cached cells and returns the collector. |
| `withActions(target, execute)` | Adds action proxy behavior to a function/object. |

## React

```js
import useVault from "@randajan/vault-kit/react";

function NoteView({ vault, id }) {
    const note = useVault(vault, id);

    return (
        <button disabled={note.isStatus(["pull", "push"])} onClick={()=>note.act.increment()}>
            {note.data?.title || note.status}
        </button>
    );
}
```

The hook returns a port with `status`, `data`, `error`, `reply`, `set()`, `act.*()`, `isStatus()`, and `confirm()`. For remote vaults, it keeps the previous data as a fallback while a reset or expiry triggers a fresh pull.

## Demo

The `/demo` folder contains an interactive workbench for the core behaviors: multi-record cache, remote pull/push, passive sync, action proxy, TTL, timeout, reset, errors, and event logging.

## License

MIT (c) [randajan](https://github.com/randajan)
