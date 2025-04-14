import { VaultPrivate } from "./VaultPrivate";

export const _privates = new WeakMap();

export class Vault {

    constructor(options={}) {
        const _p = new VaultPrivate(options);

        Object.defineProperty(this, "hasMany", {value:_p.hasMany});

        _privates.set(this, _p);
    }

    getStatus(...a) { return _privates.get(this).store.get(...a)?.status || "init"; }
    getData(...a) {
        const c = _privates.get(this).store.get(...a);
        return !c ? undefined : c.status === "ready" ? c.data : c.lastData; 
    }

    async get(...a) {
        const _p = _privates.get(this);
        const c = _p.store.get(...a);
        if (c?.status === "ready") {
            return c.data;
        }
        if (_p.remote) { return _p.resolve("pull", undefined, ...a); } 
    }

    async set(data, ...a) {
        const _p = _privates.get(this);
        if (_p.readonly) { throw new Error(`${_p.name} is readonly`); }
        if (_p.remote) { return _p.resolve("push", data, ...a); }
        
        return _p.setReady("local", data, ...a);
    }

    reset(...a) {
        _privates.get(this).store.reset(...a);
        return this;
    }

    on(fn) { _privates.get(this).handlers.add(fn); }
    once(fn) { _privates.get(this).handlers.add(fn, true); }

    async has(...a) {
        const data = await this.get(...a);
        return data !== undefined;
    }

    forEach(exe) {
        const { store, hasMany } = _privates.get(this);

        if (!hasMany) {
            const { status, data, lastData } = store.get();
            return exe({ status, data:status === "ready" ? data : lastData });
        }

        let proms;

        for (const id of store.keys()) {
            const { status, data, lastData } = store.get(id);
            if (status === "init") { continue; }
            const res = exe({status, data:status === "ready" ? data : lastData}, id);
            if (res instanceof Promise) { (proms ??= []).push(res); }
        }

        if (proms) { return Promise.all(proms); }
    }

    collect(collector, exe) {
        const res = this.forEach(ctx=>exe(collector, ctx));
        return res instanceof Promise ? res.then(_=>collector) : collector;
    }

}
