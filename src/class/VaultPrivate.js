
//status
//init, push, pull, error, ready, expired

import { toArr, toBol, toFn, toFold, toObj, toRng, withTimeout } from "../tools";
import { Cell } from "./Cell";
import { Cells } from "./Cells";
import { Handlers } from "./Handlers";

const formatRemote = (remote)=>{
    const m = "options.remote";
    remote = toObj(remote, m);
    if (!remote) { return; }

    const timeout = remote.timeout = toRng(remote.timeout, 0, 2147483647, m+".timeout") ?? 5000;
    remote.init = toFn(remote.init, m+".init");
    remote.push = withTimeout(toFn(remote.push, m+".push"), timeout);
    remote.pull = withTimeout(toFn(remote.pull, m+".pull", true), timeout);
    
    return remote;
}


const formatFold = (fold, reactions)=>{
    fold = toFold(fold, "options.onRequest", !!reactions);

    if (!reactions) { return fold; }

    return async (req, ...a)=>{
        const { action, params } = toObj(req, "request", true);

        if (!action) { throw new Error(`Action is required`); }

        const react = reactions[action];
        if (!react) { throw new Error(`Action '${action}' is not defined`); }

        const res = await react(params, ...a);
        return fold(res, ...a);
    }
}

const formatUnfold = (unfold)=>{
    unfold = toFold(unfold, "options.onResponse");
    if (!unfold) { return; }

    return async (res)=>unfold(res);
}


export class VaultPrivate {
    constructor(opt) {
        opt = toObj(opt, "options") || {};
        const remote = this.remote = formatRemote(opt.remote);

        const hasMany = this.hasMany = toBol(opt.hasMany, "options.hasMany") || false;
        this.readonly = (remote && !remote.push) || toBol(opt.readonly, "options.readonly") || false;
        const ttl = this.ttl = toRng(opt.ttl, 0, 2147483647*2, "options.ttl") ?? 0;

        this.reactions = toObj(opt.reactions, "options.reactions");
    
        this.onRequest = formatFold(opt.onRequest, this.reactions);
        this.onResponse = formatUnfold(opt.onResponse);

        this.handlers = new Handlers(toFn(opt.emitter, "options.emitter"));

        const store = this.store = hasMany ? new Cells(this) : new Cell(this);

        if (remote?.init) { remote.init((...a)=>store.setReady("remote", ...a)); }

        if (!ttl) { return; }

        const cleanUp = !hasMany ? _=>store.pick() : _=>{ for (const id of store.keys()) { store.pick(id); }}
        setInterval(cleanUp, ttl/2); 
        
    }


}