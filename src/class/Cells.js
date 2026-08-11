import { ice } from "../tools";
import { Cell } from "./Cell";



export class Cells {

    constructor(_vault, level = 0, unmount = () => { }) {
        this._vault = _vault;
        this._cont = new Map();
        this.level = level;
        this.unmountSelf = unmount;
        this.wasDestroyed = false;
    }

    isDestroyed(throwError=true) {
        if (!this.wasDestroyed) { return false; }
        if (!throwError) { return true; }
        throw new Error("Was destroyed before");
    }

    unmountSub(path) {
        const { _cont, level, wasDestroyed } = this;
        const id = path[level];
        _cont.delete(id);
        if (_cont.size || wasDestroyed) { return; }
        this.unmountSelf(path);
    }

    mountSub(id) {
        const { _vault, level, _cont } = this;
        const depthBelow = _vault.depth - level - 1;
        const unmount = this.unmountSub.bind(this);
        const c = depthBelow > 0 ? new Cells(_vault, level + 1, unmount) : new Cell(_vault, unmount);
        _cont.set(id, c);
        return c;
    }

    pick(path=[]) {
        const { level, _cont } = this;
        const id = path[level];
        return _cont.get(id)?.pick(path);
    }

    async get(path=[], extra={}) {
        this.isDestroyed();

        const { _vault, level, _cont } = this;
        const id = path[level];
        let c = _cont.get(id);

        if (!c) {
            if (!_vault.remote) { return; }
            c = this.mountSub(id);
        }

        return c.get(path, extra);
    }

    ensure(id) {
        const { _cont } = this;
        return _cont.get(id) || this.mountSub(id);
    }

    async setInit(data, path=[], extra={}) {
        this.isDestroyed();
        const id = path[this.level];
        return this.ensure(id).setInit(data, path, extra);
    }

    async set(data, path=[], extra={}) {
        this.isDestroyed();
        const id = path[this.level];
        return this.ensure(id).set(data, path, extra);
    }

    reset(status, path=[], extra={}) {
        this.isDestroyed();

        const { _vault, level, _cont } = this;
        const { handlers } = _vault;

        const onlyOne = path.length > level;

        if (onlyOne) {
            const id = path[level];
            const c = _cont.get(id)?.reset(status, path, extra);
            return c || 0;
        }

        this.wasDestroyed = (status === "destroyed");

        let c = 0;
        for (const [id, cell] of [..._cont.entries()]) {
            c += cell.reset(status, ice([...path, id]), extra);
        }

        if (this.wasDestroyed) { _cont.clear(); }

        handlers.run(ice({
            ...extra,
            status,
            path,
            isBatch:true
        }));

        return c;
    }

    forEach(exe, path=[], extra={}) {
        this.isDestroyed();

        const { _cont, level } = this;
        const onlyOne = path.length > level;

        if (onlyOne) {
            const id = path[level];
            _cont.get(id)?.forEach(exe, path, extra);
        } else {
            for (const [id, cell] of [..._cont.entries()]) {
                cell.forEach(exe, ice([...path, id]), extra);
            }
        }

    }

}
