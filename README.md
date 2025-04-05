# @randajan/vault-kit

[![NPM](https://img.shields.io/npm/v/@randajan/vault-kit.svg)](https://www.npmjs.com/package/@randajan/std-io) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

A tiny and dumb data vault for synchronizing content.  
Acts like a writeable file system, with optional remote logic.

---

## ✨ Abstract

| Concept | Description |
|--------|-------------|
| Vault | A container for named content units ("files") |
| Store | Local in-memory record of known content |
| Sync | Propagated via user-defined remote functions |
| Nullish = Remove | If content is `null` or `undefined`, it is removed |
| Event | Vault emits a single event `(id, content)` on any change |

Vault does not assume anything.  
If you don't provide logic, it won't do anything.  
Just a shell. Dumb, honest, flexible.

---

## 🧪 Example

```js
import createVault, { Vault } from "@randajan/vault-kit";

// transport setup
const vault = createVault({ //or new Vault(...)
    read: async (id) => {
        const raw = localStorage.getItem(id);
        return raw ? JSON.parse(raw) : undefined;
    },
    write: async (id, content) => {
        if (content == null) {
            localStorage.removeItem(id);
        } else {
            localStorage.setItem(id, JSON.stringify(content));
        }
        return content;
    }
});

// usage
await vault.write("hello", { msg: "world" });
console.log(await vault.read("hello")); // { msg: "world" }

vault.on((id, content) => {
    console.log("changed", id, content);
});
```


## 🧩 Options API

These functions can be provided to the constructor:

| Option         | Type                    | Args                          | Return                             | Default            |
|----------------|-------------------------|-------------------------------|-------------------------------------|--------------------|
| `create`       | `(content) => Promise<[id, content, result]>` | Used to create a new ID | Required for `vault.create()`      | ❌ Required for `create()` |
| `read`         | `(id) => Promise<content>`           | Load content from remote     | Used by `vault.read()`             | `undefined` (noop) |
| `write`        | `(id, content) => Promise<content>`  | Save content remotely        | Used by `vault.write()`            | `undefined` (noop) |
| `init`         | `(set, forget) => void`              | Called once after setup      | Used for wiring remote listeners   | `undefined` (noop)         |

If `create` is missing and `vault.create()` is called, an error is thrown.  
If `read` or `write` are missing, Vault will only manage local store.

---

## 🔁 init(set, forget)

If `init(set, forget)` is provided, Vault will call it once during construction.

| Function | Type                       | Purpose                              |
|----------|----------------------------|--------------------------------------|
| `set`    | `(id, content) => void`    | Write or remove local content        |
| `forget` | `(id) => void`             | Remove local content silently        |

Use this to bind external updates, e.g.:

```
socket.on("vault:update", ([id, content]) => set(id, content));
socket.on("vault:remove", (id) => forget(id));
```

---

## 📦 Vault methods

| Method         | Signature                          | Description                          | Async? |
|----------------|------------------------------------|--------------------------------------|--------|
| `create()`     | `async (content) => [id, content]` | Creates new ID via `options.create()` | ✅     |
| `read()`       | `async (id, noCache?) => content`  | Reads from local or remote           | ✅     |
| `write()`      | `async (id, content) => content`   | Saves content and emits change       | ✅     |
| `resync()`     | `async (id) => content`            | Forces re-read from remote           | ✅     |
| `has()`        | `(id) => boolean`                   | Returns true if locally exists    | ❌     |
| `keys()`       | `() => string[]`                   | Returns list of locally known IDs    | ❌     |
| `values()`     | `() => object[]`                   | Returns list of locally known values | ❌     |
| `entries()`    | `() => [string, object][]`         | Returns list of locally known entries    | ❌     |
| `on()`         | `(fn) => unsubscribeFn`            | Subscribes to all changes `(id, content)` | ❌ |
| `once()`       | `(fn) => unsubscribeFn`            | Subscribes once to next change       | ❌     |

When `write()` receives `null` or `undefined`, the entry is removed.

---

## 📦 Module formats

| Format | Path / Usage           |
|--------|------------------------|
| ESM    | `import { Vault } from "@randajan/vault-kit"` |
| CJS    | `const { Vault } = require("@randajan/vault-kit")` |

Both formats are included automatically in the package.


---

## **Support**
If you have any questions or suggestions for improvements, feel free to open an issue in the repository.

---

## **License**
MIT © [randajan](https://github.com/randajan)