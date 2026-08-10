import { toArr, toFn, toObj } from "../tools";
import { _privates } from "./Vault";

const notHasMany = (vint, methodName) => {
    if (!vint.hasMany) { return; }
    throw new Error(`Method '${methodName}' is not available for interface that hasMany=true`);
}

const mustHasMany = (vint, methodName) => {
    if (vint.hasMany) { return; }
    throw new Error(`Method '${methodName}' is not available for interface that hasMany=false`);
}

const toExtra = (extra)=>toObj(extra, "extra", true);

export class VaultPort {

    constructor(_vault, path = []) {

        path = Object.freeze(toArr(path, "path", true));
        const level = path.length;
        const depth = _vault.depth - level;

        if (depth < 0) {
            throw new Error(`Expected 'path' to be an array of length less then '${_vault.depth}'`);
        }

        const enumerable = true;
        Object.defineProperty(this, "path", { enumerable, value: path });
        Object.defineProperty(this, "level", { enumerable, value:level });
        Object.defineProperty(this, "depth", { enumerable, value:depth });
        Object.defineProperty(this, "hasMany", { enumerable, value:depth > 0 });
        Object.defineProperty(this, "hasRemote", {enumerable, value:!!_vault.remote});

        const act = this.act.bind(this);
        this.act = this.withActions(act, act);

        _privates.set(this, _vault);
    }

    /**
     * @preserve
     *
     * Returns the current cell status without starting a remote pull.
     *
     * @returns {VaultStatus}
     */
    getStatus() {
        notHasMany(this, "getStatus");
        return _privates.get(this).store.pick(this.path)?.status || "init";
    }

    /**
     * @preserve
     *
     * Returns cached data without starting a remote pull.
     *
     * @returns {*}
     */
    getData() {
        notHasMany(this, "getData");
        return _privates.get(this).store.pick(this.path)?.data;
    }

    /**
     * @preserve
     *
     * Returns the current cell error, if any.
     *
     * @returns {Error|undefined}
     */
    getError() {
        notHasMany(this, "getError");
        return _privates.get(this).store.pick(this.path)?.error;
    }

    /**
     * @preserve
     *
     * Checks the current cell status.
     *
     * @param {VaultStatus|VaultStatus[]} statuses Expected status or statuses.
     * @param {...*} a Cell id and extra arguments.
     * @returns {boolean}
     */
    isStatus(statuses) {
        const s = this.getStatus();
        return Array.isArray(statuses) ? statuses.includes(s) : (s === statuses);
    }

    /**
     * @preserve
     *
     * Returns cached data or starts a remote pull when needed.
     *
     * @returns {Promise<*>}
     */
    async get(extra={}) {
        notHasMany(this, "get");
        return _privates.get(this).store.get(this.path, toExtra(extra));
    }

    /**
     * @preserve
     *
     * Resolves whether get() returns a non-undefined value.
     *
     * @returns {Promise<boolean>}
     */
    async has(extra={}) {
        notHasMany(this, "has");
        return (await this.get(extra)) !== undefined;
    }

    /**
     * @preserve
     *
     * Stores data locally or pushes it through the configured remote.
     *
     * @param {*} data Data to store or push.
     * @returns {Promise<*>}
     */
    async set(data, extra={}) {
        notHasMany(this, "set");
        const { readonly, store } = _privates.get(this);
        if (readonly) { throw new Error(`Set is not allowed`); }
        return store.set(data, this.path, toExtra(extra));
    }

    /**
     * @preserve
     *
     * Sends an action request through the same write pipeline as set().
     *
     * @param {string} action Action name.
     * @param {*} data Action parameters.
     * @returns {Promise<*>}
     */
    async act(action, data, extra={}) {
        notHasMany(this, "act");
        const { readonly, store } = _privates.get(this);
        if (readonly) { throw new Error(`Actions are not allowed`); }
        return store.set(Object.freeze({ action, data }), this.path, toExtra(extra));
    }

    /**
     * @preserve
     *
     * Resets one cell to init.
     *
     * @returns {Vault}
     */
    reset(extra={}) {
        _privates.get(this).store.reset("init", this.path, toExtra(extra));
        return this;
    }

    /**
     * @preserve
     *
     * Destroys the vault and runs remote/TTL cleanup.
     *
     * Destroy is intentionally terminal: future access to destroyed cells throws.
     *
     * @returns {Vault}
     */
    destroy(extra={}) {
        _privates.get(this).destroy(this.path, toExtra(extra));
        return this;
    }

    /**
     * @preserve
     *
     * Iterates cached cells. In hasMany mode, untouched init cells are skipped.
     *
     * @param {(ctx:{ status:VaultStatus, data:*, error:*, path:Array })=>*} exe Iterator.
     * @returns {Promise<*>|undefined}
     */
    forEach(exe, extra={}) {
        mustHasMany(this, "forEach");
        const { store } = _privates.get(this);
        return store.forEach(exe, this.path, toExtra(extra));
    }


    /**
     * @preserve
     *
     * Subscribes to vault changes.
     *
     * @param {VaultListener} fn Listener.
     * @returns {Function} Unsubscribe function.
     */
    on(fn) {
        return _privates.get(this).handlers.on(fn, this);
    }

    /**
     * @preserve
     *
     * Subscribes to the next vault change only.
     *
     * @param {VaultListener} fn Listener.
     * @returns {Function} Unsubscribe function.
     */
    once(fn) {
        return _privates.get(this).handlers.once(fn, this);
    }


    /**
     * @preserve
     *
     * Adds property-based action calls to a function or object.
     *
     * Missing properties become calls to execute(prop, data, ...args), which
     * powers vault.act.someAction(data, ...args).
     *
     * @param {Function|Object} target Target to proxy.
     * @param {Function} [execute=this.act] Action executor.
     * @returns {Function|Object}
     */
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