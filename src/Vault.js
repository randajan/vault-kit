import { Store } from "./Store";

export const _privates = new WeakMap();

export class Vault {

    constructor(options={}) {
        const { name, readonly, act, react, emitter, remote } = options;
        const store = new Store({act, react, emitter});

        const _p = { name, readonly, store, remote };

        if (remote?.init) {
            remote.init((id, data, ...args)=>store.setReady("remote", id, data, args));
        }

        _privates.set(this, _p);
    }

    getStatus(id) { return _privates.get(this).store.get(id).status; }
    getData(id) {
        const c = _privates.get(this).store.get(id);
        return c.status === "ready" ? c.data : c.lastData; 
    }

    async get(id, ...args) {
        const { store, remote } = _privates.get(this);
        const c = store.get(id);
        if (c.status === "ready") { return c.data; }
        if (remote) { return store.resolve(remote.pull, "pull", id, undefined, args); } 
    }

    async set(id, data, ...args) {
        const { name, readonly, remote, store } = _privates.get(this);
        if (readonly) { throw new Error(`${name} is readonly`); }
        if (remote) { return store.resolve(remote.push, "push", id, data, args); }
        return store.setReady("local", id, data, args);
    }


    reset(id) {
        _privates.get(this).store.delete(id);
        return this;
    }

    on(fn) { _privates.get(this).store.on(fn); }
    once(fn) { _privates.get(this).store.once(fn); }

}
