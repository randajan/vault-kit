import { Cell } from "./Cell";



export class Cells extends Map {

    constructor(_vault) {
        super();
        this._vault = _vault;
    }

    pick(id) {
        const c = super.get(id);
        return c?.isExpired() ? this.reset("expired", id) : c;
    }

    async get(id, ...a) {
        const { _vault } = this;
        let c = this.pick(id);
        if (!c) {
            if (!_vault.remote) { return; }
            super.set(id, c = new Cell(_vault));
        }
        return c.get(id, ...a);
    }

    async set(data, id, ...a) {
        const { _vault } = this;
        let c = super.get(id);
        if (!c) { super.set(id, c = new Cell(_vault)); }
        return c.set(data, id, ...a);
    }

    reset(status, id, ...a) {
        const c = super.get(id);
        super.delete(id);
        return c?.reset(status, id, ...a);
    }
}