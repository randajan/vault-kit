
//status
//init, push, pull, error, ready, expired, destroyed

import { withTimeout } from "@randajan/sleep";
import { toBol, toFn, toNum, toObj, toRng, toStr } from "../tools";
import { Cell } from "./Cell";
import { Cells } from "./Cells";
import { Handlers } from "./Handlers";

/**
 * @preserve
 *
 * Normalizes remote options and wraps pull/push in @randajan/sleep.withTimeout.
 *
 * This is the critical timer boundary: remote timeout timers are cleaned up by
 * the sleep package when the wrapped promise settles, and timeout:0 preserves
 * the raw remote functions.
 *
 * @param {Object|undefined} remote User-provided remote options.
 * @returns {Object|undefined}
 */
const formatRemote = (remote) => {
    const m = "options.remote";
    remote = toObj(remote, m);
    if (!remote) { return; }

    const timeout = remote.timeout = toRng(remote.timeout, 0, 2147483647, m + ".timeout") ?? 5000;
    const push = toFn(remote.push, m + ".push");
    const pull = toFn(remote.pull, m + ".pull", true);
    remote.push = !push || !timeout ? push : (...args)=>withTimeout(push(...args), timeout);
    remote.pull = !timeout ? pull : (...args)=>withTimeout(pull(...args), timeout);

    return remote;
}

/**
 * @preserve
 *
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
 * @preserve
 *
 * Builds the local action dispatcher behind vault.act().
 *
 * The preserveAction flag decides whether a local action result replaces
 * data inside the original action envelope or becomes the direct push data.
 *
 * @param {Object.<string, Function>|undefined} actions Local action handlers.
 * @param {boolean} preserveAction Whether to keep { action, data } after a handler runs.
 * @param {Function} actionsCatch Optional action error mapper.
 * @returns {Function}
 */
const formatActions = (actions, preserveAction, actionsCatch) => {
    if (!actions) { return req=>req; }

    const ac = toFn(actionsCatch, "options.actionsCatch");

    return async (req, path, extra={}) => {
        const { action, data:input } = toObj(req, "request", true);

        if (!action) { throw new Error(`Action is required`); }

        const act = actions[action];
        if (!act) { throw new Error(`Action '${action}' is not defined`); }

        let output;
        try { output = await act(Object.freeze({...extra, data:input, path})); }
        catch(err) {
            if (!ac) { throw err; }
            output = await ac(err);
        }

        return preserveAction ? Object.freeze({ action, data:output }) : output;
    }
}

/**
 * @preserve
 *
 * Internal vault state owner.
 *
 * Keeps the public Vault facade small while this class manages the store,
 * remote lifecycle, handlers, and TTL cleanup interval.
 */
export class VaultPrivate {

    /**
     * @preserve
     *
     * @param {import("./Vault").VaultOptions} opt Vault options.
     */
    constructor(opt) {
        opt = toObj(opt, "options") || {};

        const actions = toObj(opt.actions, "options.actions");
        const remote = this.remote = formatRemote(opt.remote);

        const hasMany = toBol(opt.hasMany, "options.hasMany", false) || false;
        const depth = this.depth = toNum(opt.depth, "options.depth") || (hasMany ? 1 : 0);
        this.readonly = (remote && !remote.push) || toBol(opt.readonly, "options.readonly") || false;
        this.ttl = toRng(opt.ttl, 0, 2147483647 * 2, "options.ttl") ?? 0;

        const init = toFn(opt.init, "options.init");
        const destroy = toFn(opt.destroy, "options.destroy");
        const preserveAction = toBol(opt.preserveAction, "options.preserveAction", !!actions);
        const handlersCatch = toFn(opt.handlersCatch, "options.handlersCatch");

        this.act = formatActions(actions, preserveAction, opt.actionsCatch);
        this.unfold = formatUnfold(opt.unfold, "options.unfold");
        this.trait = toFn(opt.trait, "options.trait") || (data=>data);
        this.purge = toFn(opt.purge, "options.purge") || (data=>data);

        this.handlers = new Handlers(
            toFn(opt.emitter, "options.emitter"),
            (ctx, port)=>{
                const { path } = port;
                if (!path.length) { return true; }
                for (const i in path) { if (ctx.path[i] != path[i]) { return false; } }
                return true;
            },
            handlersCatch
        );

        
        const store = this.store = depth ? new Cells(this, 0) : new Cell(this);

        //!!!TODO INIT && DESTROY REMOTE arguments
        const initReturn = !init ? null : init((data, ...path) => store.setReady("remote", data, path));
        const initDestroy = toFn(initReturn, "options.init return value");
        
        this.destroy = path=>{
            store.reset("destroyed", path);

            if (!destroy) { initDestroy?.(path); }
            else if (!initDestroy) { destroy(path); }
            else { destroy(initDestroy, path); }
        }

    }

}
