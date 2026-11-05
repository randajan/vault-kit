import { solids } from "@randajan/props";
import { formatPath } from "../formats";
import { ice, toExtra, toFn } from "../tools";

const notHasMany = (vint, methodName) => {
    if (!vint.hasMany) { return; }
    throw new Error(`Method '${methodName}' is not available for interface that hasMany=true`);
}

export class VaultPort {

    #vault;

    constructor(_vault, path = [], baseLevel=0) {

        this.#vault = _vault;

        path = formatPath(path, _vault.depth, false, baseLevel);
        const level = path.length;
        const depth = _vault.depth - level;
        const hasMany = depth > 0;
        const hasRemote = !!_vault.remote;

        solids(this, { path, level, depth, hasMany, hasRemote });
        
        const act = this.act.bind(this);
        this.act = this.withActions(act, act);

    }

    at(...path) {
        if (!path.length) { return this; }
        
        return new VaultPort(this.#vault, [...this.path, ...path], this.level);
    }

    getStatus() {
        notHasMany(this, "getStatus");
        return this.#vault.store.pick(this.path)?.status || "init";
    }

    getData() {
        notHasMany(this, "getData");
        return this.#vault.store.pick(this.path)?.data;
    }

    getError() {
        notHasMany(this, "getError");
        return this.#vault.store.pick(this.path)?.error;
    }

    isStatus(statuses) {
        const s = this.getStatus();
        return Array.isArray(statuses) ? statuses.includes(s) : (s === statuses);
    }

    async get(extra={}) {
        notHasMany(this, "get");
        return this.#vault.store.get(this.path, toExtra(extra));
    }

    async has(extra={}) {
        notHasMany(this, "has");
        return (await this.get(extra)) !== undefined;
    }

    async set(data, extra={}) {
        notHasMany(this, "set");
        const { readonly, store } = this.#vault;
        if (readonly) { throw new Error(`Set is not allowed`); }
        return store.set(data, this.path, toExtra(extra));
    }

    async act(action, data, extra={}) {
        notHasMany(this, "act");
        const { readonly, store } = this.#vault;
        if (readonly) { throw new Error(`Actions are not allowed`); }
        return store.set(ice({ action, data }), this.path, toExtra(extra));
    }

    reset(extra={}) {
        this.#vault.store.reset("init", this.path, toExtra(extra));
        return this;
    }

    destroy(extra={}) {
        this.#vault.store.reset("destroyed", this.path, toExtra(extra));
        return this;
    }

    forEach(exe, extra={}) {
        const { store } = this.#vault;
        return store.forEach(exe, this.path, toExtra(extra));
    }

    on(fn, bounceOpts) {
        return this.#vault.handlers.on(fn, this.path, bounceOpts);
    }

    once(fn, bounceOpts) {
        return this.#vault.handlers.once(fn, this.path, bounceOpts);
    }

    withActions(target, execute) {
        const d = toFn(execute, "second argument") || this.act;

        return new Proxy(target, {
            get(t, action, receiver) {
                const val = Reflect.get(t, action, receiver);
                if (val !== undefined) { return val; }
                return (data, extra={}) => d(action, data, extra);
            }
        });
    }

}
