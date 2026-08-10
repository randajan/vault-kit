export class Cell {

    constructor(_vault, unmount=()=>{}) {
        this.status = "init";
        this._vault = _vault;
        this.unmountSelf = unmount;
    }

    notDestroyed() {
        if (this.status !== "destroyed") { return true; }
        throw new Error("Was destroyed before");
    }

    isExpired() { return this.expiresAt && (this.expiresAt < Date.now()); }

    onSet(persistent, before={}, path=[], extra={}) {
        const { _vault, status, data, error, currentTimeoutId } = this;
        const { ttl, handlers } = _vault;

        if (currentTimeoutId != null) { clearInterval(currentTimeoutId); }
        if (persistent) { delete this.expiresAt; }
        else if (ttl > 0) {
            this.expiresAt = Date.now() + ttl;
            const tid = this.currentTimeoutId = setTimeout(_=>this.pick(path), ttl);
            tid.unref?.();
        }
        
        return handlers.run(Object.freeze({
            ...extra,
            status,
            data,
            error,
            before:Object.freeze(before),
            path,
        }));
    }

    async fetchRemote(status, data, path=[], extra={}) {
        try {
            const { push, pull } = this._vault.remote;
            const packet = Object.freeze({...extra, data, path});
            const prom = status === "push" ? push(packet) : pull(packet);
            return this.setReady(status, await prom, path, extra);
        } catch(err) {
            throw this.setError(err, path, extra);
        }
    };

    setProm(status, data, path=[], extra={}) {
        const { data:d, status:s } = this;

        this.status = status;
        this.prom = this.fetchRemote(status, data, path, extra);
        delete this.error;

        this.onSet(true, { data:d, status:s }, path, extra);
        return this.prom;
    }

    setError(err, path=[], extra={}) {
        const { data:d, status:s } = this;

        this.status = "error"
        this.error = err;
        delete this.prom;

        this.onSet(false, { data:d, status:s }, path, extra);
        return err;
    }

    async setReady(mode, data, path=[], extra={}) { //mode = push|pull|remote|local
        const { _vault, data:d, status:s } = this;
        const { unfold, trait, purge } = _vault;

        let res = data;
        
        if (unfold && (mode === "local" || mode === "push")) { [data, res] = await unfold(data); }

        if (this.data != null) { purge(this.data); }
        this.data = await trait(data, res);

        this.status = "ready";
        delete this.error;
        delete this.prom;

        this.onSet(false, { data:d, status:s }, path, extra);

        return res;
    }

    pick(path=[]) {
        if (this.isExpired()) { this.reset("expired", path); }
        return this;
    }

    async get(path=[], extra={}) {
        this.notDestroyed();
        
        const { _vault, status, data, prom } = this.pick(path);
        const { remote } = _vault;
        if (status === "ready") { return data; }
        if (!remote) { return; }
        if (status === "pull") { return prom; } //same same
        if (status === "push") { await prom; return this.data; }

        return this.setProm("pull", undefined, path, extra); //packet
    }

    async set(data, path=[], extra={}) {
        this.notDestroyed();

        const { _vault, prom } = this;
        const { remote, act } = _vault;

        if (!remote) { return this.setReady("local", await act(data, path, extra), path, extra); }

        const push = async _=>this.setProm("push", await act(data, path, extra), path, extra);
        return !prom ? push() : (this.prom = this.prom.then(push));
    }

    reset(status, path=[], extra={}) {
        this.notDestroyed();

        const { _vault, data:d, status:s } = this;
        const { purge } = _vault;

        try {
            if (this.data != null) { purge(this.data); }
        } catch(err) {
            throw this.setError(err, path, extra);
        }

        this.status = status;
        delete this.data;
        delete this.prom;
        delete this.error;
        delete this.expiresAt;

        if (status !== "destroyed") { this.unmountSelf(path); }
        this.onSet(true, { status:s, data:d }, path, extra);

        return 1;
    }

    forEach(exe, path=[], extra={}) {
        this.notDestroyed();
        
        const { status, data, error } = this.pick(path);
        exe(Object.freeze({ ...extra, status, data, error, path }));
    }

}
