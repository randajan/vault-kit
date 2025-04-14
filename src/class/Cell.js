
export class Cell {

    constructor(onSet) {
        this.status = "init";
        this.onSet = onSet;
    }

    ensure() { return this; }
    get() {
        if (!this.isExpired()) { return this; }
        this.reset();
    }

    set(status, to, ttl, ...a) {
        const { status:lastStatus, data, lastData } = this;
        const from = lastStatus === "ready" ? data : lastData;

        this.status = status;
        this.data = to;
        if (ttl > 0) { this.expiresAt = Date.now() + ttl; }
        
        if (status === "ready") { delete this.lastData; } else { this.lastData = from; }

        this.onSet({status, to, from}, ...a);

        return to;
    }

    isExpired() {
        return this.expiresAt && (this.expiresAt < Date.now());
    }

    reset(...a) {
        this.status = "init";
        const from = this.data;

        delete this.data;
        delete this.lastData;
        delete this.expiresAt;

        this.onSet({ status:"expired", from }, ...a);

        return this;
    }
}
