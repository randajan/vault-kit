import { VaultPrivate } from "./VaultPrivate";

export const _privates = new WeakMap();

export class Vault {

    constructor(options={}) {
        const _p = new VaultPrivate(options);

        Object.defineProperty(this, "hasMany", {value:_p.hasMany});

        this.do = this.do.bind(this);
        this.do = this.withActions(this.do);

        _privates.set(this, _p);
    }

    getStatus(...a) { return _privates.get(this).store.pick(...a)?.status || "init"; }
    getData(...a) { return _privates.get(this).store.pick(...a)?.data; }

    async get(...a) { return _privates.get(this).store.get(...a); }
    async set(data, ...a) {
        const { readonly, store } = _privates.get(this);
        if (readonly) { throw new Error(`Set is not allowed`); }
        return store.set(data, ...a);
    }

    async do(action, params, ...a) {
        return _privates.get(this).store.set({action, params}, ...a);
    }

    reset(...a) {
        _privates.get(this).store.reset("init", ...a);
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
            const { status, data } = store.pick();
            return exe({ status, data });
        }

        let proms;

        for (const id of store.keys()) {
            const { status, data } = store.pick(id);
            if (status === "init") { continue; }
            const res = exe({status, data}, id);
            if (res instanceof Promise) { (proms ??= []).push(res); }
        }

        if (proms) { return Promise.all(proms); }
    }

    collect(collector, exe) {
        const res = this.forEach(ctx=>exe(collector, ctx));
        return res instanceof Promise ? res.then(_=>collector) : collector;
    }

    withActions(target) {
        const d = this.do;

        return new Proxy(target, {
            get(t, prop, receiver) {
                const val = Reflect.get(t, prop, receiver);
                if (val !== undefined) { return val; }
                return (params, ...a) =>d(prop, params, ...a);
            }
        });
    }


}
