import { toFn } from "./tools";

//status
//init, push, pull, error, ready

const resolveOut = async (store, exe, status, data, id, args)=>{
    const prom = status === "push" ? exe(data, id, ...args) : exe(id, ...args);
    return store.setReady(status, await prom, id, args);
};

const resolveIn = async (store, exe, status, data, id, args)=>{
    const prom = resolveOut(store, exe, status, data, id, args)
        .catch(err=>{ throw store.set("error", err, id, args); });

    return store.set(status, prom, id, args);
}

export class Store extends Map {
    constructor(traits) {
        super();
        this.handlers = new Set();
        this.traits = traits;
        this.emit = this.emit.bind(this);
    }

    emit(...a) {
        for (const fn of [...this.handlers]) { fn(...a); }
    }

    get(id) { return super.get(id) || { status:"init" } }

    set(status, to, id, args) {
        const { emit, traits:{ emitter } } = this
        let c = super.get(id);
        if (!c) { super.set(id, c = {}); }

        const from = c.status === "ready" ? c.data : c.lastData;

        c.status = status;
        c.data = to;
        if (status === "ready") { delete c.lastData; } else { c.lastData = from; }
        
        if (emitter) { emitter(emit, {id, status, to, from}, ...args); }
        else { emit(Object.freeze({id, status, to, from}), ...args); }

        return to;
    }

    async setReady(mode, data, id, args) { //mode = push|pull|remote|local
        const { onResponse, onRequest } = this.traits;

        let res = data;
        
        if (onRequest && mode === "local") { [data, res] = await onRequest(data, id, ...args); }
        if (onResponse && mode === "push") { [data, res] = await onResponse(data, id, ...args); }

        this.set("ready", data, id, args);

        return res;
    }

    async resolve(exe, status, data, id, args) {
        const c = this.get(id);
        if (!c.status.startsWith("pu")) { return resolveIn(this, exe, status, data, id, args); }
        return c.data = c.data.finally(_=>resolveIn(this, exe, status, data, id, args));
    }

    on(fn) {
        const { handlers } = this;
        fn = toFn(fn, "fn argument", true);
        handlers.add(fn);
        return () => handlers.delete(fn);
    }

    once(fn) {
        const rem = this.on((...a)=>{
            rem();
            return fn(...a);
        });
        return rem;
    }

}