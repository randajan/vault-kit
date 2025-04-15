
//status
//init, push, pull, error, ready

import { toArr, toBol, toFn, toFold, toNum, toObj, toRng, toStr } from "../tools";
import { Cell } from "./Cell";
import { Cells } from "./Cells";
import { Handlers } from "./Handlers";

const formatRemote = (remote)=>{
    remote = toObj(remote, "options.remote");
    if (!remote) { return; }

    remote.init = toFn(remote.init, "options.remote.init");       //(set)=>{ set(); }
    remote.push = toFn(remote.push, "options.remote.push");       //(data, id)=>data;
    remote.pull = toFn(remote.pull, "option.remote.pull", true);  //(id)=>data;

    return remote;
}


const formatFold = (fold, reactions)=>{
    fold = toFold(fold, "options.fold", !!reactions);

    if (!reactions) { return fold; }

    return async (req, ...a)=>{
        const { action, params } = toObj(req, "request", true);

        const react = reactions[action];
        if (!react) { throw new Error(`Action '${action}' is not defined`); }

        const res = await react(params, ...a);
        return fold(res, ...a);
    }
}

const formatUnfold = (unfold)=>{
    unfold = toFold(unfold, "options.unfold");
    if (!unfold) { return; }

    return async (res)=>unfold(res);
}


export class VaultPrivate {
    constructor(opt) {
        opt = toObj(opt, "options") || {};
        const remote = this.remote = formatRemote(opt.remote);

        this.name = toStr(opt.name, "options.name") || "Vault";
        const hasMany = this.hasMany = toBol(opt.hasMany, "options.hasMany") || false;
        this.readonly = (remote && !remote.push) || toBol(opt.readonly, "options.readonly") || false;
        const ttl = this.ttl = toRng(opt.ttl, 0, 2147483647, "options.ttl");

        this.reactions = toObj(opt.reactions, "options.reactions");
        this.actions = toArr(opt.actions, "options.array");
    
        this.onRequest = formatFold(opt.onRequest, this.reactions);
        this.onResponse = formatUnfold(opt.onResponse);

        const emitter = this.emitter = toFn(opt.emitter, "options.emitter");
        const handlers = this.handlers = new Handlers();
        const onSet = !emitter ? handlers.run : (...a)=>emitter(handlers.run, ...a);

        const store = this.store = hasMany ? new Cells(onSet) : new Cell(onSet);

        if (remote?.init) { remote.init((...a)=>this.setReady("remote", ...a)); }

        if (!ttl || !hasMany) { return; }
        
        setInterval(_=>{
            for (const id of store.keys()) { store.get(id); } //this will do auto cleanUp
        }, ttl);
    }

    set(status, data, ...a) {
        const { store, ttl } = this;
        return store.ensure(...a).set(status, data, ttl, ...a);
    }

    async setReady(mode, data, ...a) { //mode = push|pull|remote|local
        const { onResponse, onRequest } = this;

        let res = data;
        
        if (onRequest && mode === "local") { [data, res] = await onRequest(data, ...a); }
        if (onResponse && mode === "push") { [data, res] = await onResponse(data, ...a); }

        this.set("ready", data, ...a);

        return res;
    }

    async resolveOut(status, data, ...a) {
        const { push, pull } = this.remote;
        const prom = status === "push" ? push(data, ...a) : pull(...a);
        return this.setReady(status, await prom, ...a);
    };
    
    async resolveIn(status, data, ...a) {
        const prom = this.resolveOut(status, data, ...a)
            .catch(err=>{ throw this.set("error", err, ...a); });
        return this.set(status, prom, ...a);
    }

    async resolve(status, data, ...a) {
        const c = this.store.get(...a);
        if (!c || !c.status.startsWith("pu")) { return this.resolveIn(status, data, ...a); }
        // if (status === "pull") { console.log("AAA"); return c.data = c.data.then(_=>{
        //     console.log("AAAAAA");
        //     return "AAA";
        // });}
        return c.data = c.data.then(_=>this.resolveIn(status, data, ...a));
    }

}