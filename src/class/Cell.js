import { ice } from "../tools";


export class Cell {

    constructor(_vault, unmount=()=>{}) {
        this.status = "init";
        this._vault = _vault;
        this.unmountSelf = unmount;
    }

    isDestroyed(throwError=true) {
        if (this.status !== "destroyed") { return false; }
        if (!throwError) { return true; }
        throw new Error("Was destroyed before");
    }

    isExpired() { return this.expiresAt && (this.expiresAt < Date.now()); }

    onSet(persistent, before={}, path=[], extra={}, batched=undefined) {
        const { _vault, status, data, error, currentTimeoutId } = this;
        const { ttl, handlers } = _vault;

        if (currentTimeoutId != null) { clearInterval(currentTimeoutId); }
        if (persistent) { delete this.expiresAt; }
        else if (ttl > 0) {
            this.expiresAt = Date.now() + ttl;
            const tid = this.currentTimeoutId = setTimeout(_=>this.pick(path), ttl);
            tid.unref?.();
        }

        const event = ice({
            ...extra,
            status,
            data,
            error,
            before:ice(before),
            path,
            batch:batched ? "item" : undefined
        });

        batched?.push(event);
        
        return handlers.run(event);
    }

    async fetchRemote(status, data, path=[], extra={}) {
        try {
            const { push, pull } = this._vault.remote;
            const isPush = status === "push";

            const prom = isPush
                ? push(ice({...extra, path, data, pull:_=>pull(ice({...extra, path}))}))
                : pull(ice({...extra, path}));

            return this.setReady(isPush, await prom, path, extra);
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

    async setReady(isResponse, data, path=[], extra={}) {
        const { _vault, data:d, status:s } = this;
        const { unfold, trait, purge } = _vault;

        let res = data;
        
        if (unfold && isResponse) { [data, res] = await unfold(data); }

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

    async setInit(data, path=[], extra={}) {
        this.isDestroyed();
        return this.setReady(false, data, path, extra);
    }

    async get(path=[], extra={}) {
        this.isDestroyed();

        const { _vault, status, data, prom } = this.pick(path);
        const { remote } = _vault;
        
        if (status === "ready") { return data; }
        if (!remote) { return; }
        if (status === "pull") { return prom; } //same same
        if (status === "push") { await prom; return this.data; }

        return this.setProm("pull", undefined, path, extra); //packet
    }

    async set(data, path=[], extra={}) {
        this.isDestroyed();

        const { _vault, prom } = this;
        const { remote, act } = _vault;

        if (!remote) { return this.setReady(true, await act(data, path, extra), path, extra); }

        const push = async _=>this.setProm("push", await act(data, path, extra), path, extra);
        return !prom ? push() : (this.prom = this.prom.then(push));
    }

    reset(status, path=[], extra={}, batched=undefined) {
        this.isDestroyed();

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
        this.onSet(true, { status:s, data:d }, path, extra, batched);

        return 1;
    }

    forEach(exe, path=[], extra={}) {     
        this.isDestroyed();

        const { status, data, error } = this.pick(path);
        exe(ice({ ...extra, status, data, error, path }));
    }

}
