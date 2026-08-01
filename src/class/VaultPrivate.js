
//status
//init, push, pull, error, ready, expired, destroyed

import { withTimeout } from "@randajan/sleep";
import { toBol, toFn, toObj, toRng, toStr } from "../tools";
import { Cell } from "./Cell";
import { Cells } from "./Cells";
import { Handlers } from "./Handlers";

/**
 * Normalizes remote options and wraps pull/push in @randajan/sleep.withTimeout.
 *
 * This is the critical timer boundary: remote timeout timers are cleaned up by
 * the sleep package when the wrapped promise settles, and timeout:0 preserves
 * the raw remote functions.
 *
 * @param {Object|undefined} remote User-provided remote options.
 * @param {boolean} [reqPreserveActions=false] Whether preserveAction must be explicit.
 * @returns {Object|undefined}
 */
const formatRemote = (remote, reqPreserveActions=false) => {
    const m = "options.remote";
    remote = toObj(remote, m);
    if (!remote) { return; }

    const timeout = remote.timeout = toRng(remote.timeout, 0, 2147483647, m + ".timeout") ?? 5000;
    remote.init = toFn(remote.init, m + ".init");
    const push = toFn(remote.push, m + ".push");
    const pull = toFn(remote.pull, m + ".pull", true);
    remote.push = !push || !timeout ? push : (...args)=>withTimeout(push(...args), timeout);
    remote.pull = !timeout ? pull : (...args)=>withTimeout(pull(...args), timeout);
    remote.preserveAction = toBol(remote.preserveAction, m + ".preserveAction", reqPreserveActions);
    remote.destroy = toFn(remote.destroy, m + ".destroy");

    return remote;
}

/**
 * Creates the result splitter used after local set() and remote push().
 *
 * It lets callers receive the whole operation result while the vault stores
 * only the selected data fragment.
 *
 * @param {Function|string|undefined} fold Extractor function or property name.
 * @param {string} errorName Name used in validation errors.
 * @param {boolean} [req=false] Whether identity unfolding is required.
 * @returns {Function|undefined}
 */
export const formatUnfold = (fold, errorName, req=false)=>{
    const f = toFn(fold);
    if (f) { return f; }
    let prop = toStr(fold, errorName);
    if (prop) { return (r=>[r[prop], r]); }
    if (req) { return (r=>[r, r]); }
}


/**
 * Builds the local action dispatcher behind vault.act().
 *
 * The preserveAction flag decides whether a local action result replaces
 * params inside the original action envelope or becomes the direct push data.
 *
 * @param {Object.<string, Function>|undefined} actions Local action handlers.
 * @param {boolean} preserveAction Whether to keep { action, params } after a handler runs.
 * @param {Function} actionsCatch Optional action error mapper.
 * @returns {Function}
 */
const formatActions = (actions, preserveAction, actionsCatch) => {
    if (!actions) { return req=>req; }

    const ac = toFn(actionsCatch, "options.actionsCatch");

    return async (req, ...a) => {
        const { action, params } = toObj(req, "request", true);

        if (!action) { throw new Error(`Action is required`); }

        const act = actions[action];
        if (!act) { throw new Error(`Action '${action}' is not defined`); }

        let data;
        try { data = await act(params, ...a); }
        catch(err) {
            if (!ac) { throw err; }
            data = await ac(err);
        }

        return preserveAction ? { action, params:data } : data;
    }
}

/**
 * Internal vault state owner.
 *
 * Keeps the public Vault facade small while this class manages the store,
 * remote lifecycle, handlers, and TTL cleanup interval.
 */
export class VaultPrivate {

    /**
     * @param {import("./Vault").VaultOptions} opt Vault options.
     */
    constructor(opt) {
        opt = toObj(opt, "options") || {};

        const actions = toObj(opt.actions, "options.actions");
        const remote = this.remote = formatRemote(opt.remote, !!actions);

        const hasMany = this.hasMany = toBol(opt.hasMany, "options.hasMany") || false;
        this.readonly = (remote && !remote.push) || toBol(opt.readonly, "options.readonly") || false;
        const ttl = this.ttl = toRng(opt.ttl, 0, 2147483647 * 2, "options.ttl") ?? 0;

        this.act = formatActions(actions, remote?.preserveAction, opt.actionsCatch);
        this.unfold = formatUnfold(opt.unfold, "options.unfold");
        this.trait = toFn(opt.trait, "options.trait") || (data=>data);
        this.purge = toFn(opt.purge, "options.purge") || (data=>data);

        this.handlers = new Handlers(toFn(opt.emitter, "options.emitter"));

        const store = this.store = hasMany ? new Cells(this) : new Cell(this);

        if (remote?.init) { this.initDestroy = remote.init((...a) => store.setReady("remote", ...a)); }

        const destroy = remote?.destroy ? _=>remote.destroy(this.initDestroy) : toFn(this.initDestroy, "remote.init return value") || (()=>{});

        if (!ttl) {
            this.destroy = destroy;
        } else {
            /**
             * TTL cleanup must be detached from the Node.js event loop and tied
             * to destroy(); otherwise long-lived intervals keep processes open.
             */
            const cleanUp = !hasMany ? _ => store.pick() : _ => { for (const id of store.keys()) { store.pick(id); } }
            const interval = setInterval(cleanUp, ttl / 2);
            interval.unref?.();
            this.destroy = _=>{
                clearInterval(interval);
                return destroy();
            }
        }

    }

    reset(status, ...a) {
        const { store } = this;
        store.reset(status, ...a);
    }

    resetAll(status, ...a) {
        const { store } = this;
        store.resetAll(status, ...a);
    }

}
