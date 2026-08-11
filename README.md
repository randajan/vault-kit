# @randajan/vault-kit

[![NPM](https://img.shields.io/npm/v/@randajan/vault-kit.svg)](https://www.npmjs.com/package/@randajan/vault-kit)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

A tiny event-driven data vault for local cache, remote sync, actions, and passive updates.

`vault-kit` gives you one small primitive that can behave like a single cached value or a multi-record store. You provide the transport: REST, WebSocket, localStorage, IndexedDB, memory, GraphQL, custom APIs, anything that returns data.

## Features

- Single-value or multi-record mode with the same port API.
- Local cache with status tracking.
- Lazy remote `pull()` on first read or after reset/expiry.
- Remote `push()` on local writes.
- Passive remote-to-local sync through `remote.init()`.
- Lifecycle cleanup through `destroy()` and `remote.destroy()`.
- Action proxy via `vault.act.someAction(data)`.
- `ttl` support with timers that do not keep Node.js alive.
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
        pull:({ path })=>fetch(`/api/notes/${path[0]}`).then(res=>res.json()),
        push:({ data, path })=>fetch(`/api/notes/${path[0]}`, {
            method:"PUT",
            headers:{ "content-type":"application/json" },
            body:JSON.stringify(data)
        }).then(res=>res.json())
    }
});

notes.on(ctx=>{
    console.log(ctx.status, ctx.path[0], ctx.data);
});

const notePort = notes.at("welcome");
const note = await notePort.get();
await notePort.set({ ...note, title:"Hello" });
```

## Core Model

A vault stores cells. In the default mode there is one cell:

```js
const user = createVault();

await user.set({ name:"Ada" });
console.log(await user.get());
```

With `hasMany:true`, bind a port to a cell before reading or writing:

```js
const users = createVault({ hasMany:true });

await users.at("ada").set({ name:"Ada" });
await users.at("grace").set({ name:"Grace" });

console.log(await users.at("ada").get());
```

For deeper stores, use `depth` or chain ports:

```js
const files = createVault({ depth:2 });

await files.at("docs").at("readme").set({ title:"Readme" });
```

Each cell has one of these statuses:

| Status | Meaning |
|--------|---------|
| `init` | Empty or reset. |
| `push` | Waiting for `remote.push()`. |
| `pull` | Waiting for `remote.pull()`. |
| `error` | Last pull, push, action, trait, or purge failed. |
| `ready` | Data is available. |
| `expired` | TTL expired and the cell was reset. |
| `destroyed` | Cell or subtree was destroyed and cannot be used again. |

## Options

```js
import createVault, { Vault } from "@randajan/vault-kit";

const vault = createVault(options);
const same = new Vault(options);
```

| Option | Type | Description |
|--------|------|-------------|
| `hasMany` | `boolean` | Enables one path segment. Defaults to `false`. |
| `depth` | `number` | Number of required path segments. Overrides `hasMany` when greater than `0`. |
| `readonly` | `boolean` | Blocks `set()` and `act.*()`. |
| `remote` | `object` | Remote pull/push/init/destroy adapter. |
| `ttl` | `number` | Time-to-live in ms. `0` disables expiry. |
| `actions` | `object` | Local action handlers used by `act()`. |
| `actionsCatch` | `(error) => data` | Converts action errors into fallback data. |
| `unfold` | `function` or `string` | Extracts stored data from a result. |
| `trait` | `(data, result) => data` | Transforms data before it is stored. |
| `purge` | `(oldData) => void` | Runs before old data is discarded. |

### Remote

`pull()`, `push()`, and `destroy()` receive frozen packets. Operation extra fields are copied directly onto those packets.

| Remote option | Type | Description |
|---------------|------|-------------|
| `pull` | `(packet) => data \| Promise<data>` | Required when `remote` is used. Called by `get()`. |
| `push` | `(packet) => data \| Promise<data>` | Called by `set()` and `act.*()`. If missing, the vault is readonly. |
| `init` | `(set) => initReturn` | Passive-sync setup. Runs once during vault construction. |
| `destroy` | `(packet, initReturn) => void` | Cleans up remote resources when `destroy()` is called. |
| `timeout` | `number` | Remote timeout in ms. Defaults to `5000`; `0` disables timeout wrapping. |
| `preserveAction` | `boolean` | Required when local `actions` and `remote` are both provided. Keeps `{ action, data }` after a local action runs. |

Pull and push packet fields:

| Field | Description |
|-------|-------------|
| `path` | Cell path array. |
| `data` | Data being pushed. Only present for `push()`. |
| `pull` | Helper available during `push()` to read remote data for the same path. |

Destroy receives `{ path, ...extra }` as its packet and the value returned by `remote.init()` as its second argument.

Remote timeouts use `@randajan/sleep.withTimeout()`. Its internal timer is cleaned up when the remote promise settles and uses unref behavior in Node.js, so a pending timeout timer does not keep a process alive by itself.

## Actions

`act()` sends an `{ action, data }` request through the same write pipeline as `set()`.

```js
await vault.act("increment", { by:1 });
await vault.act.increment({ by:1 });
```

You can let the remote side interpret the action request:

```js
const client = createVault({
    hasMany:true,
    remote:{
        pull:({ path })=>api.get(path[0]),
        push:({ data:request, path })=>api.action(path[0], request.action, request.data)
    }
});

await client.at("note-1").act.rename({ title:"New title" });
```

Or define local actions that convert user intent into data before push:

```js
const vault = createVault({
    hasMany:true,
    actions:{
        rename:({ data })=>({ title:data.title })
    },
    remote:{
        preserveAction:false,
        pull:({ path })=>api.get(path[0]),
        push:({ data, path })=>api.save(path[0], data)
    }
});

await vault.at("note-1").act.rename({ title:"New title" });
```

Use `actionsCatch` when action errors should become data instead of thrown errors:

```js
const vault = createVault({
    actions:{
        save:({ data })=>{
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

`purge` runs before old data is discarded by `set()`, `reset()`, or expiry.

## Events

Subscribe with `on()` or `once()`. Listeners receive a single `ctx` object; `ctx.path` identifies the cell.

```js
const off = vault.on(ctx=>{
    console.log(ctx.status, ctx.path, ctx.data, ctx.error);
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
| `path` | Cell path array. |
| `isBatch` | `true` when the context describes a subtree operation. |

Operation extra fields are copied directly onto the context:

```js
vault.on(ctx=>{
    console.log(ctx.origin);
});

await vault.set({ value:1 }, { origin:"manual-save" });
```

## Passive Sync

Use `remote.init` to connect passive remote updates. The setter receives `(data, path = [], extra = {})`.

```js
const client = createVault({
    hasMany:true,
    remote:{
        init:set=>{
            const off = socket.on("note", note=>{
                set(note, [note.id], { origin:"socket" });
            });
            return off;
        },
        destroy:(_packet, off)=>off?.(),
        pull:({ path })=>api.get(path[0])
    }
});
```

If `remote.init` returns a cleanup function and `remote.destroy` is not configured, `destroy()` calls that function with the destroy packet.

## TTL

`ttl` marks non-persistent values for expiry. Expired cells reset to `expired` when they are accessed.

```js
const vault = createVault({ ttl:5000 });

await vault.set({ value:1 });

setTimeout(()=>console.log(vault.getStatus()), 6000); // expired
```

## API

| Method | Description |
|--------|-------------|
| `at(...path)` | Returns a port bound to a deeper path. |
| `get(extra)` | Returns cached data or starts `remote.pull()`. |
| `set(data, extra)` | Stores local data or pushes to remote. |
| `act(action, data, extra)` | Runs an action through the write pipeline. |
| `act.name(data, extra)` | Proxy shorthand for `act("name", data, extra)`. |
| `getStatus()` | Returns the current status. |
| `getData()` | Returns cached data without pulling. |
| `getError()` | Returns the current error. |
| `isStatus(statusOrList)` | Checks the current status. |
| `has(extra)` | Resolves to `true` when `get()` returns a non-`undefined` value. |
| `reset(extra)` | Resets the bound cell or subtree to `init`. |
| `destroy(extra)` | Destroys the bound cell or subtree and runs remote cleanup. |
| `on(fn)` | Subscribes to events. Returns an unsubscribe function. |
| `once(fn)` | Subscribes to the next event only. |
| `forEach(fn, extra)` | Iterates cached cells from a multi-cell port. |
| `withActions(target, execute)` | Adds action proxy behavior to a function/object. |

Cell methods such as `get()`, `set()`, `act()`, and `getData()` are available only when the current port is bound to a complete path. `forEach()` is available only while the current port still has child cells.

`destroy()` is terminal. Use `reset()` for cache invalidation when a cell should be usable again later.

## React

```js
import useVault from "@randajan/vault-kit/react";

function NoteView({ vault, id }) {
    const note = useVault(vault, [id]);

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
