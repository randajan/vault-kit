import React, { useEffect, useMemo, useState } from "react";
import { Vault } from "../class/Vault";

/**
 * @preserve
 *
 * @typedef {Object} VaultPort
 * @property {import("../class/Vault").VaultStatus} status Current cell status.
 * @property {*} data Cached data or remote fallback while a refresh is pending.
 * @property {Error|undefined} error Current cell error.
 * @property {*} reply Last result returned by set() or act.*().
 * @property {Function} confirm Clears reply and redraws the hook consumer.
 * @property {(data:*, ...args:*)=>Promise<*>} set Writes to the bound vault cell.
 * @property {Object} act Action proxy bound to the selected cell.
 * @property {(statuses:string|string[], ...args:*)=>boolean} isStatus Status helper.
 */

const validateVault = (vault) => {
    if (!(vault instanceof Vault)) { throw Error("vault must be instance of Vault"); }
};


const createController = (vault, redraw, path=[], autoInit=true) => {
    validateVault(vault);
    const port = path.length ? vault.at(...path) : vault;

    let reply, fallback;

    const d = async (action, data, extra)=>reply = await port.act(action, data, extra);
    
    const enumerable = true;
    const ctrl = Object.defineProperties({}, {
        status: { enumerable, get:() => port.getStatus() },
        data: { enumerable, get: () => port.getData() || fallback },
        error: { enumerable, get: () => port.getError() },
        reply: { enumerable, get: () => reply },
        confirm: { value:() => { reply = undefined; redraw(Symbol()); } },
        set:{ value:async (data, extra) =>reply = await port.set(data, extra)},
        act:{ value:port.withActions(d, d) },
        isStatus: { value:statuses=>port.isStatus(statuses) },
    });

    const cleanUp = port.on(ctx=> {
        const { status, before } = ctx;
        if (port.hasRemote) {
            if (status === "init" || status === "expired") { fallback = before.data; port.get(); }
            else if (status === "ready" || status === "error" || status === "destroyed") { fallback = undefined; }
        }
        redraw(Symbol());
    });

    if (autoInit) { port.get(); }

    return [ ctrl, cleanUp ];
};


/**
 * @preserve
 *
 * React binding for one vault cell.
 *
 * For remote vaults, reset and expiry keep the previous data as a temporary
 * fallback while the hook starts a fresh pull.
 *
 * @param {Vault} vault Vault instance.
 * @param {path*} a Cell path
 * @returns {VaultPort}
 */
export const useVault = (vault, path=[], autoInit=true)=>{
    const redraw = useState(0)[1];

    const [ ctrl, cleanUp ] = useMemo(_=>createController(vault, redraw, path, autoInit), [vault, ...path, autoInit]);

    useEffect(_=>cleanUp, [cleanUp]);

    return ctrl;
}

