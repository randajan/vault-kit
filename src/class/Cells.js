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

    async get(id, ...a) { return this.pick(id)?.get(id, ...a); }

    async set(data, id, ...a) {
        let c = super.get(id);
        if (!c) { super.set(id, c = new Cell(this._vault)); }
        return c.set(data, id, ...a);
    }

    reset(status, id, ...a) {
        const c = super.get(id);
        super.delete(id);
        return c?.reset(status, id, ...a);
    }
}