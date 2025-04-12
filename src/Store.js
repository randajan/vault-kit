import { toFn } from "./tools";

//status
//init, push, pull, error, ready

const resolveOut = async (store, exe, status, id, data, args)=>{
    const prom = status === "push" ? exe(id, data, ...args) : exe(id, ...args);
    return store.setReady(status, id, await prom, args);
};

const resolveIn = async (store, exe, status, id, data, args)=>{
    const prom = resolveOut(store, exe, status, id, data, args)
        .catch(err=>{ throw store.set("error", id, err, args); });

    return store.set(status, id, prom, args);
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

    set(status, id, to, args) {
        const { emit, traits:{ emitter } } = this
        let c = super.get(id);
        if (!c) { super.set(id, c = {}); }

        const from = c.status === "ready" ? c.data : c.lastData;

        c.status = status;
        c.data = to;
        if (status === "ready") { delete c.lastData; } else { c.lastData = from; }
        
        if (emitter) { emitter(emit, id, {status, to, from}, ...args); }
        else { emit(id, Object.freeze({status, to, from}), ...args); }

        return to;
    }

    async setReady(mode, id, data, args) { //mode = push|pull|remote|local
        const { act, react } = this.traits;

        let result = data;

        if (react && mode === "local") { [data, result] = await react(id, data, ...args); }
        if (act && mode === "push") { [data, result] = await act(id, data, ...args); }

        this.set("ready", id, data, args);

        return result;
    }

    async resolve(exe, status, id, data, args) {
        const c = this.get(id);
        if (!c.status.startsWith("pu")) { return resolveIn(this, exe, status, id, data, args); }
        return c.data = c.data.finally(_=>resolveIn(this, exe, status, id, data, args));
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