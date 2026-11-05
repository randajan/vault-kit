
//status
//init, push, pull, error, ready, expired

import { withTimeout } from "@randajan/sleep";
import { ice, toArr, toBol, toFn, toNum, toObj, toRng, toStr } from "./tools";


export const formatRemote = (remote, reqPreserveAction=false) => {
    const m = "options.remote";
    remote = toObj(remote, m);
    if (!remote) { return; }

    const timeout = remote.timeout = toRng(remote.timeout, 0, 2147483647, m + ".timeout") ?? 5000;
    const push = toFn(remote.push, m + ".push");
    const pull = toFn(remote.pull, m + ".pull", true);
    remote.init = toFn(remote.init, m + ".init");
    remote.destroy = toFn(remote.destroy, m + ".destroy");
    remote.push = !push || !timeout ? push : (...args)=>withTimeout(push(...args), timeout);
    remote.pull = !timeout ? pull : (...args)=>withTimeout(pull(...args), timeout);
    remote.preserveAction = toBol(remote.preserveAction, m + ".preserveAction", reqPreserveAction);

    return remote;
}



export const formatUnfold = (fold, errorName, req=false)=>{
    const f = toFn(fold);
    if (f) { return f; }
    let prop = toStr(fold, errorName);
    if (prop) { return (r=>[r[prop], r]); }
    if (req) { return (r=>[r, r]); }
}


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


export const formatPath = (path, depth, exactOnly=false, baseLevel=0)=>{
    path = ice(toArr(path, "path", depth > 0) || []);

    const isValid = exactOnly ? path.length == depth : path.length <= depth;
    if (isValid) { return path; }

    const m = exactOnly ? "fixed length" : "length less then";
    throw new Error(`Expected 'path' to be an array of ${m} '${depth - baseLevel}'`);

}
