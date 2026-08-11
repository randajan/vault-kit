
//status
//init, push, pull, error, ready, expired, destroyed

import { is, toBol, toExtra, toFn, toNum, toObj, toRng } from "../tools";
import { Cell } from "./Cell";
import { Cells } from "./Cells";
import { Handlers } from "./Handlers";
import { formatActions, formatPath, formatRemote, formatUnfold } from "../formats";


/**
 * @preserve
 *
 * Internal vault state owner.
 *
 * Keeps the public Vault facade small while this class manages the store,
 * remote setup, handlers, and TTL expiry.
 */
export class VaultPrivate {

    /**
     * @preserve
     *
     * @param {import("./Vault").VaultOptions} opt Vault options.
     */
    constructor(opt) {
        opt = toObj(opt, "options") || {};

        const actions = toObj(opt.actions, "options.actions");
        const remote = this.remote = formatRemote(opt.remote, !!actions);

        const hasMany = toBol(opt.hasMany, "options.hasMany", false) || false;
        const depth = this.depth = toNum(opt.depth, "options.depth") || (hasMany ? 1 : 0);
        this.readonly = (remote && !remote.push) || toBol(opt.readonly, "options.readonly") || false;
        this.ttl = toRng(opt.ttl, 0, 2147483647 * 2, "options.ttl") ?? 0;

        this.act = formatActions(actions, remote?.preserveAction, opt.actionsCatch);
        this.unfold = formatUnfold(opt.unfold, "options.unfold");
        this.trait = toFn(opt.trait, "options.trait") || (data => data);
        this.purge = toFn(opt.purge, "options.purge") || (data => data);

        this.handlers = new Handlers(
            (ctx, sPath) => {
                if (!sPath.length) { return true; }
                for (const i in sPath) { if (ctx.path[i] != sPath[i]) { return false; } }
                return true;
            },
            toFn(opt.handlersCatch, "options.handlersCatch")
        );

        const store = this.store = depth ? new Cells(this, 0) : new Cell(this);

        const rDestroy = remote?.destroy;
        const rInitReturn = remote?.init?.((data, path, extra = {}) => {
            path = formatPath(path, this.depth, true);
            return store.setInit(data, path, toExtra(extra));
        });

        const rInitReturnIsFn = rInitReturn == null ? null : is("function", rInitReturn);
        if (!rDestroy && rInitReturnIsFn === false) {
            throw new Error("options.remote.destroy is required when options.remote.init returns a non-function value");
        }

        this.handlers.on(ctx=>{
            const { status } = ctx;
            if (status !== "destroyed") { return; }
            if (rDestroy) { rDestroy(ctx, rInitReturn); }
            else if (rInitReturnIsFn) { rInitReturn(ctx); }
        }, []);

    }

}
