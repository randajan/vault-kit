import React, { useEffect, useMemo, useState } from "react";
import { Vault } from "../class/Vault";

/**
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


const createPort = (vault, redraw, ...a) => {
    validateVault(vault);

    let reply, fallback;

    const d = async (action, params, ...e)=>reply = await vault.act(action, params, ...a, ...e);
    
    const enumerable = true;
    const port = Object.defineProperties({}, {
        status: { enumerable, get:() => vault.getStatus(...a) },
        data: { enumerable, get: () => vault.getData(...a) || fallback },
        error: { enumerable, get: () => vault.getError(...a) },
        reply: { enumerable, get: () => reply },
        confirm: { value:() => { reply = undefined; redraw(Symbol()); } },
        set:{ value:async (data, ...e) =>reply = await vault.set(data, ...a, ...e)},
        act:{ value:vault.withActions(d, d) },
        isStatus: { value:(statuses, ...e) =>vault.isStatus(statuses, ...a, ...e) },
    });

    const cleanUp = vault.on((ctx, ...e) => {
        for (const i in a) { if (e[i] != a[i]) { return; } }
        const { status, before } = ctx;
        if (vault.hasRemote) {
            if (status === "init" || status === "expired") { fallback = before.data; vault.get(...a); }
            else if (status === "ready" || status === "error" || status === "destroyed") { fallback = undefined; }
        }
        redraw(Symbol());
    });

    vault.get(...a);

    return [ port, cleanUp ];
};


/**
 * React binding for one vault cell.
 *
 * For remote vaults, reset and expiry keep the previous data as a temporary
 * fallback while the hook starts a fresh pull.
 *
 * @param {Vault} vault Vault instance.
 * @param {...*} a Cell id and extra arguments.
 * @returns {VaultPort}
 */
export const useVault = (vault, ...a)=>{
    const redraw = useState(0)[1];

    const [ port, cleanUp ] = useMemo(_=>createPort(vault, redraw, ...a), [vault, ...a]);

    useEffect(_=>cleanUp, [cleanUp]);

    return port;
}

