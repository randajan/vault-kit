import { toFn } from "../tools";
import { VaultPrivate } from "./VaultPrivate";

export const _privates = new WeakMap();

export class Vault {

    constructor(options={}) {
        const _p = new VaultPrivate(options);

        const enumerable = true;
        Object.defineProperty(this, "hasMany", {enumerable, value:_p.hasMany});
        Object.defineProperty(this, "hasRemote", {enumerable, value:!!_p.remote});

        const act = this.act.bind(this);
        this.act = this.withActions(act, act);

        _privates.set(this, _p);
    }

    getStatus(...a) { return _privates.get(this).store.pick(...a)?.status || "init"; }
    getData(...a) { return _privates.get(this).store.pick(...a)?.data; }
    getError(...a) { return _privates.get(this).store.pick(...a)?.error; }

    isStatus(statuses, ...a) {
        const s = this.getStatus(...a);
        return Array.isArray(statuses) ? statuses.includes(s) : (s === statuses);
    }


    async get(...a) { return _privates.get(this).store.get(...a); }
    async set(data, ...a) {
        const { readonly, store } = _privates.get(this);
        if (readonly) { throw new Error(`Set is not allowed`); }
        return store.set(data, ...a);
    }

    async act(action, params, ...a) {
        const { readonly, store } = _privates.get(this);
        if (readonly) { throw new Error(`Do is not allowed`); }
        return store.set({action, params}, ...a);
    }

    reset(...a) {
        _privates.get(this).store.reset("init", ...a);
        return this;
    }

    resetAll(...a) {
        if (!this.hasMany) { return this.reset(...a); }
        return this.forEach((ctx, id)=>this.reset(id, ...a));
    }

    on(fn) { return _privates.get(this).handlers.on(fn); }
    once(fn) { return _privates.get(this).handlers.once(fn); }

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

        for (const id of [...store.keys()]) {
            const { status, data } = store.pick(id);
            if (status === "init") { continue; }
            const res = exe({status, data}, id);
            if (res instanceof Promise) { (proms ??= []).push(res); }
        }

        if (proms) { return Promise.all(proms); }
    }

    collect(collector, exe) {
        const res = this.forEach((ctx, id)=>exe(collector, ctx, id));
        return res instanceof Promise ? res.then(_=>collector) : collector;
    }

    withActions(target, execute) {
        const d = toFn(execute, "second argument") || this.act;

        return new Proxy(target, {
            get(t, prop, receiver) {
                const val = Reflect.get(t, prop, receiver);
                if (val !== undefined) { return val; }
                return (params, ...a) =>d(prop, params, ...a);
            }
        });
    }


}
