import { toFn } from "../tools";


export class Handlers {
    constructor(filter=(ctx, selector)=>true, catcher=(err)=>{}) {
        this._list = [];

        this.run = (ctx)=>{
            for (const [fn, selector] of [...this._list]) {
                if (!filter(ctx, selector)) { continue; }
                let err, ok = true;
                try { fn(ctx); } catch(error) { err = error; ok = false; }
                if (!ok) { try { catcher(err); } catch {}; }
            }
        }
        
    }

    on(fn, selector) {
        fn = toFn(fn, "fn argument", true);
        const { _list } = this;
        const rec = [fn, selector];
        _list.push(rec);
        return () => {
            const x = _list.indexOf(rec);
            if (x >= 0) { _list.splice(x, 1); }
        }
    }

    once(fn, selector) {
        let rem;
        return rem = this.on((...a)=>{ rem(); return fn(...a); }, selector);
    }

}
