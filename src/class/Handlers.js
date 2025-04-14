import { toFn } from "../tools";


export class Handlers extends Set {
    constructor() {
        super();
        this.run = this.run.bind(this);
    }

    run(...args) {
        for (const fn of [...this]) { fn(...args); }
    }

    add(fn, once=false) {
        fn = toFn(fn, "fn argument", true);
        let rem = () => this.delete(fn);
        super.add(!once ? fn : (...a)=>{ rem(); return fn(...a); });
        return rem;
    }

}