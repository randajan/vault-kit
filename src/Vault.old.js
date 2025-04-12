const _privates = new WeakMap();

const toFn = (fn, optName, require=false)=>{
    if (typeof fn === "function") { return fn; }
    if (!require && fn == null) { return; }
    throw new TypeError(`Expected ${optName} to be a function, got ${typeof fn}`);
}

export class Vault {
    constructor(options={}) {
        const _p = {
            store: new Map(),
            handlers: new Set()
        };

        _p.emit = (id, content) => {
            for (const fn of [..._p.handlers]) { fn(id, content); }
        }

        _p.forget = (id) => {
            _p.store.delete(id);
        }

        _p.set = (id, content) => {
            if (content == null) { _p.forget(id); }
            else { _p.store.set(id, content); }
            _p.emit(id, content);
        }

        _p.init = toFn(options.init);
        _p.remoteCreate = toFn(options.create);
        _p.remoteRead = toFn(options.read);
        _p.remoteWrite = toFn(options.write);

        if (_p.init) { _p.init(_p.set, _p.forget); }

        _privates.set(this, _p);
    }

    async create(content) {
        const { remoteCreate, set } = _privates.get(this);
        if (!remoteCreate) {
            throw new Error("Vault.create(...) is not available: no 'create' function provided in options.");
        }
        const [id, realContent, result] = await remoteCreate(content);
        set(id, realContent);
        return result;
    }

    async read(id, noCache=false) {
        const { store, set, remoteRead } = _privates.get(this);
        if (!noCache && store.has(id)) { return store.get(id); }
        if (!remoteRead) { return; }
        const realContent = await remoteRead(id);
        set(id, realContent);
        return realContent;
    }

    async write(id, content) {
        const { set, remoteWrite } = _privates.get(this);
        const realContent = !remoteWrite ? content : await remoteWrite(id, content);
        set(id, realContent);
        return realContent;
    }

    async resync(id) {
        return this.read(id, true);
    }

    has(id) { return _privates.get(this).store.has(id); }
    keys() { return _privates.get(this).store.keys(); }
    values() { return _privates.get(this).store.values(); }
    entries() { return _privates.get(this).store.entries(); }

    on(fn) {
        const { handlers } = _privates.get(this);
        fn = toFn(fn, "argument", true);
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
