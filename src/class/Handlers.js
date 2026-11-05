import { Bounce } from "@randajan/bounce";
import { toFn } from "../tools";


export class Handlers {

    #cfg = {};

    constructor(opt = {}) {
        const cfg = this.#cfg;

        cfg.list = new Set();
        cfg.filter = opt.filter = (event, selector) => true;
        cfg.catcher = opt.catcher = (err) => { };

    }

    run(event) {
        const { list, filter, catcher } = this.#cfg;
        for (const { fn, selector } of [...list]) {
            if (!filter(event, selector)) { continue; }
            let err, ok = true;
            try { fn(event); } catch (error) { err = error; ok = false; }
            if (!ok) { try { catcher(err); } catch { }; }
        }
        return event;
    }

    #remove(rec) {
        const { list } = this.#cfg;
        if (!list.has(rec)) { return false; }
        list.delete(rec);
        return true;
    }

    #onSimple(rec) {
        const { list } = this.#cfg;
        list.add(rec);
        return _ => this.#remove(rec);
    }

    #onBatch(rec, bounceOpts = {}) {
        const { onDestroy } = bounceOpts;
        let rem;

        const bounce = new Bounce(rec.fn, {
            ...bounceOpts,
            onDestroy: () => {
                rem?.();
                return onDestroy?.();
            }
        });

        rec.fn = event => bounce.attach(event);
        rem = this.#onSimple(rec);

        return bounce;
    }

    on(fn, selector, bounceOpts) {
        const rec = { selector, fn:toFn(fn, "fn argument", true) };
        return bounceOpts ? this.#onBatch(rec, bounceOpts) : this.#onSimple(rec);
    }

    once(fn, selector, bounceOpts) {
        let res;
        const exe = bounceOpts ? (...a) => { res.destroy(); return fn(...a); } : (...a) => { res(); return fn(...a); };
        return res = this.on(exe, selector, bounceOpts);
    }

}
