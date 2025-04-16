import { toFn } from "../tools";


export class Handlers {
    constructor(emitter) {
        this.list = [];

        const run = (...args)=>{
            for (const fn of [...this.list]) { fn(...args); }
        }

        this.run = !emitter ? run : (...a)=>emitter(run, ...a);
    }

    on(fn) {
        fn = toFn(fn, "fn argument", true);
        const { list } = this;
        list.push(fn);
        return () => {
            const x = list.indexOf(fn);
            if (x >= 0) { list.splice(x, 1); }
        }
    }

    once(fn) {
        let rem;
        return rem = this.on((...a)=>{ rem(); return fn(...a); });
    }

}