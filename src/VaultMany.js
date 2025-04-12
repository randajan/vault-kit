import { formatOpt } from "./tools";
import { _privates, Vault } from "./Vault";

export class VaultMany extends Vault {

    constructor(options={}) {
        super(formatOpt(true, options));
    }

    async has(id, ...args) {
        const data = await this.get(id, ...args);
        return data !== undefined;
    }

    forEach(exe) {
        const entries = _privates.get(this).store.entries();
        let proms;

        for (const [id, {status, data, lastData}] of entries) {
            const res = exe(status, id, status === "ready" ? data : lastData);
            if (res instanceof Promise) { (proms ??= []).push(res); }
            
        }

        if (proms) { return Promise.all(proms); }
    }

    collect(collector, exe) {
        const res = this.forEach((status, id, data)=>exe(collector, status, id, data));
        return res instanceof Promise ? res.then(_=>collector) : collector;
    }


}
