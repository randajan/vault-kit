import { formatOpt } from "./tools";
import { _privates, Vault } from "./Vault";

export class VaultOne extends Vault {

    constructor(options={}) {
        super(formatOpt(false, options));
    }

    getStatus() { return super.getStatus(); }
    getData() { return super.getData(); }

    async get(...args) { return super.get(undefined, ...args); }

    async set(data, ...args) { return super.set(undefined, data, ...args); }
    reset() { return super.reset(undefined); }

    on(fn) { _privates.get(this).store.on(fn); }
    once(fn) { _privates.get(this).store.once(fn); }

}