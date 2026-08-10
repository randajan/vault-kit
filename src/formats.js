
//status
//init, push, pull, error, ready, expired

import { withTimeout } from "@randajan/sleep";
import { ice, toArr, toBol, toFn, toNum, toObj, toRng, toStr } from "./tools";


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
 * @param {boolean} [reqPreserveAction=false] Whether preserveAction is required.
 * @returns {Object|undefined}
 */
export const formatRemote = (remote, reqPreserveAction=false) => {
    const m = "options.remote";
    remote = toObj(remote, m);
    if (!remote) { return; }

    const timeout = remote.timeout = toRng(remote.timeout, 0, 2147483647, m + ".timeout") ?? 5000;
    const push = toFn(remote.push, m + ".push");
    const pull = toFn(remote.pull, m + ".pull", true);
    remote.push = !push || !timeout ? push : (...args)=>withTimeout(push(...args), timeout);
    remote.pull = !timeout ? pull : (...args)=>withTimeout(pull(...args), timeout);
    remote.preserveAction = toBol(remote.preserveAction, m + ".preserveAction", reqPreserveAction);

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
 * @param {boolean|undefined} preserveAction Whether to keep { action, data } after a handler runs.
 * @param {Function} actionsCatch Optional action error mapper.
 * @returns {Function}
 */
export const formatActions = (actions, preserveAction, actionsCatch) => {
    if (!actions) { return req=>req; }

    const ac = toFn(actionsCatch, "options.actionsCatch");

    return async (req, path, extra={}) => {
        const { action, data:input } = toObj(req, "request", true);

        if (!action) { throw new Error(`Action is required`); }

        const act = actions[action];
        if (!act) { throw new Error(`Action '${action}' is not defined`); }

        let output;
        try { output = await act(ice({...extra, data:input, path})); }
        catch(err) {
            if (!ac) { throw err; }
            output = await ac(err);
        }

        return preserveAction ? ice({ action, data:output }) : output;
    }
}


/**
 * @preserve
 *
 * Normalizes and validates a vault path.
 *
 * Empty paths are allowed for single-cell vaults. Addressed vaults require
 * arrays, and passive init updates can require an exact path length.
 *
 * @param {Array|undefined} path User-provided path.
 * @param {number} depth Vault depth.
 * @param {boolean} [exactOnly=false] Whether path length must equal depth.
 * @param {number} [baseLevel=0] Level used only for error messages.
 * @returns {ReadonlyArray}
 */
export const formatPath = (path, depth, exactOnly=false, baseLevel=0)=>{
    path = ice(toArr(path, "path", depth > 0) || []);

    const isValid = exactOnly ? path.length == depth : path.length <= depth;
    if (isValid) { return path; }

    const m = exactOnly ? "fixed length" : "length less then";
    throw new Error(`Expected 'path' to be an array of ${m} '${depth - baseLevel}'`);

}
