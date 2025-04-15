import { Cell } from "./Cell";



export class Cells extends Map {

    constructor(onSet) {
        super();
        this.onSet = onSet;
    }

    ensure(id) {
        let c = super.get(id);
        if (!c) { super.set(id, c = new Cell(this.onSet)); }
        return c;
    }

    get(id) {
        const c = super.get(id);
        if (!c?.isExpired()) { return c; }
        this.reset(id);
    }

    reset(id, ...a) {
        const c = super.get(id);
        super.delete(id);
        c?.reset(id, ...a);
    }
}