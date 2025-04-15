
export class Cell {

    constructor(_vault) {
        this.status = "init";
        this._vault = _vault;
    }

    isExpired() { return this.expiresAt && (this.expiresAt < Date.now()); }

    pick() { return this.isExpired() ? this.reset("expired") : this; }

    onSet(persistent, before, ...a) {
        const { _vault, status, data, error } = this;
        const { ttl, onSet } = _vault;
        if (persistent) { delete this.expiresAt; }
        else if (ttl > 0) { this.expiresAt = Date.now() + ttl; }
        return onSet({status, data, error, before}, ...a);
    }

    async fetchRemote(status, data, ...a) {
        try {
            const { push, pull } = this._vault.remote;
            const prom = status === "push" ? push(data, ...a) : pull(...a);
            return this.setReady(status, await prom, ...a);
        } catch(err) {
            throw this.setError(err);
        }
    };

    setProm(status, data, ...a) {
        const { data:d, status:s } = this;

        this.status = status;
        this.prom = this.fetchRemote(status, data, ...a);
        delete this.error;

        this.onSet(true, { data:d, status:s }, ...a);
        return this.prom;
    }

    setError(err, ...a) {
        const { data:d, status:s } = this;

        this.status = "error"
        this.error = err;
        delete this.prom;

        this.onSet(false, { data:d, status:s }, ...a);
        return err;
    }

    async setReady(mode, data, ...a) { //mode = push|pull|remote|local
        const { _vault, data:d, status:s } = this;
        const { onResponse, onRequest } = _vault;

        let res = data;
        
        if (onRequest && mode === "local") { [data, res] = await onRequest(data, ...a); }
        if (onResponse && mode === "push") { [data, res] = await onResponse(data, ...a); }

        this.status = "ready";
        this.data = data;
        delete this.error;
        delete this.prom;

        this.onSet(false, { data:d, status:s }, ...a);
        return res;
    }

    async get(...a) {
        const { _vault, status, data, prom } = this.pick();
        const { remote } = _vault;
        if (status === "ready") { return data; }
        if (!remote) { return; }
        if (status === "pull") { return prom; } //same same
        if (status === "push") { await prom; return this.data; }

        return this.setProm("pull", undefined, ...a);
    }

    async set(data, ...a) {
        const { _vault, prom } = this;
        const { remote } = _vault;
        if (!remote) { return this.setReady("local", data, ...a); }
        if (!prom) { return this.setProm("push", data, ...a); }

        return this.prom = this.prom.then(_=>this.setProm("push", data, ...a));
    }

    reset(status, ...a) {
        const { data:d, status:s } = this;

        this.status = status;
        delete this.data;
        delete this.prom;
        delete this.queue;
        delete this.error;
        delete this.expiresAt;

        this.onSet(true, { status:s, data:d }, ...a);

        return this;
    }
}
