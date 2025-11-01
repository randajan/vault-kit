
//status
//init, push, pull, error, ready, expired, destroyed

import { toBol, toFn, toObj, toRng, toStr, withTimeout } from "../tools";
import { Cell } from "./Cell";
import { Cells } from "./Cells";
import { Handlers } from "./Handlers";

const formatRemote = (remote, reqPreserveActions=false) => {
    const m = "options.remote";
    remote = toObj(remote, m);
    if (!remote) { return; }

    const timeout = remote.timeout = toRng(remote.timeout, 0, 2147483647, m + ".timeout") ?? 5000;
    remote.init = toFn(remote.init, m + ".init");
    remote.push = withTimeout(toFn(remote.push, m + ".push"), timeout);
    remote.pull = withTimeout(toFn(remote.pull, m + ".pull", true), timeout);
    remote.preserveAction = toBol(remote.preserveAction, m + ".preserveAction", reqPreserveActions);
    remote.destroy = toFn(remote.destroy, m + ".destroy");

    return remote;
}

export const formatUnfold = (fold, errorName, req=false)=>{
    const f = toFn(fold);
    if (f) { return f; }
    let prop = toStr(fold, errorName);
    if (prop) { return (r=>[r[prop], r]); }
    if (req) { return (r=>[r, r]); }
}


const formatActions = (actions, preserveAction) => {
    if (!actions) { return req=>req; }

    return async (req, ...a) => {
        const { action, params } = toObj(req, "request", true);

        if (!action) { throw new Error(`Action is required`); }

        const act = actions[action];
        if (!act) { throw new Error(`Action '${action}' is not defined`); }

        const data = await act(params, ...a);
        return preserveAction ? { action, params:data } : data;
    }
}

export class VaultPrivate {
    constructor(opt) {
        opt = toObj(opt, "options") || {};

        const actions = toObj(opt.actions, "options.actions");
        const remote = this.remote = formatRemote(opt.remote, actions);

        const hasMany = this.hasMany = toBol(opt.hasMany, "options.hasMany") || false;
        this.readonly = (remote && !remote.push) || toBol(opt.readonly, "options.readonly") || false;
        const ttl = this.ttl = toRng(opt.ttl, 0, 2147483647 * 2, "options.ttl") ?? 0;

        this.act = formatActions(actions, remote?.preserveAction);
        this.unfold = formatUnfold(opt.unfold, "options.unfold");
        this.trait = toFn(opt.trait, "options.trait") || (data=>data);
        this.purge = toFn(opt.purge, "options.purge") || (data=>data);

        this.handlers = new Handlers(toFn(opt.emitter, "options.emitter"));

        const store = this.store = hasMany ? new Cells(this) : new Cell(this);

        if (remote?.init) { this.initDestroy = remote.init((...a) => store.setReady("remote", ...a)); }

        if (remote?.destroy) { this.destroy = _=>remote.destroy(this.initDestroy); }
        else { this.destroy = toFn(this.initDestroy, "remote.init return value") || (()=>{}); }

        if (!ttl) { return; }

        const cleanUp = !hasMany ? _ => store.pick() : _ => { for (const id of store.keys()) { store.pick(id); } }
        setInterval(cleanUp, ttl / 2);

    }

    reset(status, ...a) {
        const { store } = this;
        store.reset(status, ...a);
    }

    resetAll(status, ...a) {
        if (!this.hasMany) { this.reset(status, ...a); }
        else { this.forEach((ctx, id)=>this.reset(status, id, ...a)); }
    }

}