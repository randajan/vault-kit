
export class Cell {

    constructor(_vault) {
        this.status = "init";
        this._vault = _vault;
    }

    notDestroyed() {
        if (this.status !== "destroyed") { return true; }
        throw new Error("Was destroyed before");
    }

    isExpired() { return this.expiresAt && (this.expiresAt < Date.now()); }

    onSet(persistent, before, ...a) {
        const { _vault, status, data, error } = this;
        const { ttl, handlers } = _vault;
        if (persistent) { delete this.expiresAt; }
        else if (ttl > 0) { this.expiresAt = Date.now() + ttl; }

        return handlers.run({status, data, error, before}, ...a);
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
        const { unfold, trait, purge } = _vault;

        let res = data;
        
        if (unfold && (mode === "local" || mode === "push")) { [data, res] = await unfold(data); }

        if (this.data != null) { purge(this.data); }
        this.data = await trait(data, res);

        this.status = "ready";
        delete this.error;
        delete this.prom;

        this.onSet(false, { data:d, status:s }, ...a);
        return res;
    }

    pick() { return this.isExpired() ? this.reset("expired") : this; }

    async get(...a) {
        this.notDestroyed();
        
        const { _vault, status, data, prom } = this.pick();
        const { remote } = _vault;
        if (status === "ready") { return data; }
        if (!remote) { return; }
        if (status === "pull") { return prom; } //same same
        if (status === "push") { await prom; return this.data; }

        return this.setProm("pull", undefined, ...a);
    }

    async set(data, ...a) {
        this.notDestroyed();

        const { _vault, prom } = this;
        const { remote, act } = _vault;

        if (!remote) { return this.setReady("local", await act(data, ...a), ...a); }

        const push = async _=>this.setProm("push", await act(data, ...a), ...a);
        return !prom ? push() : (this.prom = this.prom.then(push));
    }

    reset(status, ...a) {
        this.notDestroyed();

        const { _vault, data:d, status:s } = this;
        const { purge } = _vault;

        try {
            if (this.data != null) { purge(this.data); }
        } catch(err) {
            throw this.setError(err);
        }

        this.status = status;
        delete this.data;
        delete this.prom;
        delete this.error;
        delete this.expiresAt;

        this.onSet(true, { status:s, data:d }, ...a);

        return this;
    }
}
