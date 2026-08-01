import { toFn } from "../tools";
import { VaultPrivate } from "./VaultPrivate";

/**
 * @typedef {"init"|"push"|"pull"|"error"|"ready"|"expired"|"destroyed"} VaultStatus
 */

/**
 * Event context passed to vault listeners.
 *
 * @typedef {Object} VaultContext
 * @property {VaultStatus} status Current cell status.
 * @property {*} [data] Current cached data.
 * @property {Error} [error] Current error.
 * @property {{ status?:VaultStatus, data?:* }} [before] Previous cell snapshot.
 */

/**
 * @callback VaultListener
 * @param {VaultContext} ctx
 * @param {...*} args Cell id and extra arguments passed through the operation.
 */

/**
 * @callback RemoteSetter
 * @param {*} data Data received from a passive remote update.
 * @param {...*} args Cell id and extra arguments.
 * @returns {Promise<*>}
 */

/**
 * Remote adapter used by a vault.
 *
 * @typedef {Object} VaultRemoteOptions
 * @property {number} [timeout=5000] Timeout for pull and push in milliseconds. Use 0 to disable wrapping.
 * @property {Function} [init] Passive-sync setup. Receives a RemoteSetter; its return value is passed to destroy.
 * @property {Function} pull Reads from the remote source.
 * @property {Function} [push] Writes to the remote source. Missing push makes the vault readonly.
 * @property {Function} [destroy] Cleans up remote resources.
 * @property {boolean} [preserveAction] Keeps the action envelope after local actions run.
 */

/**
 * Main vault configuration.
 *
 * @typedef {Object} VaultOptions
 * @property {boolean} [hasMany=false] Enables multiple addressed cells.
 * @property {boolean} [readonly=false] Blocks set and act calls.
 * @property {VaultRemoteOptions} [remote] Remote pull/push/init adapter.
 * @property {number} [ttl=0] Time-to-live in milliseconds. Use 0 to disable expiry.
 * @property {Object.<string, Function>} [actions] Local action handlers.
 * @property {(error:Error)=>*} [actionsCatch] Converts local action errors into data.
 * @property {Function|string} [unfold] Extracts cached data from set/push results.
 * @property {(data:*, result:*)=>*} [trait] Transforms data before it is stored.
 * @property {(oldData:*)=>void} [purge] Runs before old cached data is discarded.
 * @property {(emit:VaultListener, ctx:VaultContext, ...args:*)=>void} [emitter] Custom event dispatcher.
 */

export const _privates = new WeakMap();

/**
 * Public vault facade.
 *
 * A vault owns cached cells, optional remote synchronization, action dispatch,
 * event subscriptions, and lifecycle cleanup.
 */
export class Vault {

    /**
     * @param {VaultOptions} [options={}] Vault configuration.
     */
    constructor(options={}) {
        const _p = new VaultPrivate(options);

        const enumerable = true;
        Object.defineProperty(this, "hasMany", {enumerable, value:_p.hasMany});
        Object.defineProperty(this, "hasRemote", {enumerable, value:!!_p.remote});

        const act = this.act.bind(this);
        this.act = this.withActions(act, act);

        _privates.set(this, _p);
    }

    /**
     * Returns the current cell status without starting a remote pull.
     *
     * @param {...*} a Cell id and extra arguments.
     * @returns {VaultStatus}
     */
    getStatus(...a) { return _privates.get(this).store.pick(...a)?.status || "init"; }

    /**
     * Returns cached data without starting a remote pull.
     *
     * @param {...*} a Cell id and extra arguments.
     * @returns {*}
     */
    getData(...a) { return _privates.get(this).store.pick(...a)?.data; }

    /**
     * Returns the current cell error, if any.
     *
     * @param {...*} a Cell id and extra arguments.
     * @returns {Error|undefined}
     */
    getError(...a) { return _privates.get(this).store.pick(...a)?.error; }

    /**
     * Checks the current cell status.
     *
     * @param {VaultStatus|VaultStatus[]} statuses Expected status or statuses.
     * @param {...*} a Cell id and extra arguments.
     * @returns {boolean}
     */
    isStatus(statuses, ...a) {
        const s = this.getStatus(...a);
        return Array.isArray(statuses) ? statuses.includes(s) : (s === statuses);
    }


    /**
     * Returns cached data or starts a remote pull when needed.
     *
     * @param {...*} a Cell id and extra arguments.
     * @returns {Promise<*>}
     */
    async get(...a) { return _privates.get(this).store.get(...a); }

    /**
     * Stores data locally or pushes it through the configured remote.
     *
     * @param {*} data Data to store or push.
     * @param {...*} a Cell id and extra arguments.
     * @returns {Promise<*>}
     */
    async set(data, ...a) {
        const { readonly, store } = _privates.get(this);
        if (readonly) { throw new Error(`Set is not allowed`); }
        return store.set(data, ...a);
    }

    /**
     * Sends an action request through the same write pipeline as set().
     *
     * @param {string} action Action name.
     * @param {*} params Action parameters.
     * @param {...*} a Cell id and extra arguments.
     * @returns {Promise<*>}
     */
    async act(action, params, ...a) {
        const { readonly, store } = _privates.get(this);
        if (readonly) { throw new Error(`Do is not allowed`); }
        return store.set({action, params}, ...a);
    }

    /**
     * Resets one cell to init.
     *
     * @param {...*} a Cell id and extra arguments.
     * @returns {Vault}
     */
    reset(...a) {
        _privates.get(this).reset("init", ...a);
        return this;
    }

    /**
     * Resets all cells to init.
     *
     * @param {...*} a Extra event arguments.
     * @returns {Vault}
     */
    resetAll(...a) {
        _privates.get(this).resetAll("init", ...a);
        return this;
    }

    /**
     * Destroys the vault and runs remote/TTL cleanup.
     *
     * Destroy is intentionally terminal: future access to destroyed cells throws.
     *
     * @param {...*} a Extra event arguments.
     * @returns {Vault}
     */
    destroy(...a) {
        const _vault = _privates.get(this);
        _vault.resetAll("destroyed", ...a);
        _vault.destroy();
        return this;
    }

    /**
     * Subscribes to vault changes.
     *
     * @param {VaultListener} fn Listener.
     * @returns {Function} Unsubscribe function.
     */
    on(fn) { return _privates.get(this).handlers.on(fn); }

    /**
     * Subscribes to the next vault change only.
     *
     * @param {VaultListener} fn Listener.
     * @returns {Function} Unsubscribe function.
     */
    once(fn) { return _privates.get(this).handlers.once(fn); }

    /**
     * Resolves whether get() returns a non-undefined value.
     *
     * @param {...*} a Cell id and extra arguments.
     * @returns {Promise<boolean>}
     */
    async has(...a) {
        const data = await this.get(...a);
        return data !== undefined;
    }

    /**
     * Iterates cached cells. In hasMany mode, untouched init cells are skipped.
     *
     * @param {(ctx:{ status:VaultStatus, data:* }, id?:*)=>*} exe Iterator.
     * @returns {Promise<*>|undefined}
     */
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

    /**
     * Iterates cached cells and returns the collector after async work settles.
     *
     * @param {*} collector Mutable collector passed to every iteration.
     * @param {(collector:*, ctx:{ status:VaultStatus, data:* }, id?:*)=>*} exe Iterator.
     * @returns {*|Promise<*>}
     */
    collect(collector, exe) {
        const res = this.forEach((ctx, id)=>exe(collector, ctx, id));
        return res instanceof Promise ? res.then(_=>collector) : collector;
    }

    /**
     * Adds property-based action calls to a function or object.
     *
     * Missing properties become calls to execute(prop, params, ...args), which
     * powers vault.act.someAction(params, ...args).
     *
     * @param {Function|Object} target Target to proxy.
     * @param {Function} [execute=this.act] Action executor.
     * @returns {Function|Object}
     */
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
