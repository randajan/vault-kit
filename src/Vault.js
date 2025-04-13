import { Store } from "./Store";

export const _privates = new WeakMap();

export class Vault {

    constructor(options={}) {
        const { name, readonly, onRequest, onResponse, emitter, remote } = options;
        const store = new Store({onRequest, onResponse, emitter});

        const _p = { name, readonly, store, remote };

        if (remote?.init) {
            remote.init((data, id, ...args)=>store.setReady("remote", data, id, args));
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
        if (remote) { return store.resolve(remote.pull, "pull", undefined, id, args); } 
    }

    async set(data, id, ...args) {
        const { name, readonly, remote, store } = _privates.get(this);
        if (readonly) { throw new Error(`${name} is readonly`); }
        if (remote) { return store.resolve(remote.push, "push", data, id, args); }
        return store.setReady("local", data, id, args);
    }


    reset(id) {
        _privates.get(this).store.delete(id);
        return this;
    }

    on(fn) { _privates.get(this).store.on(fn); }
    once(fn) { _privates.get(this).store.once(fn); }

}
