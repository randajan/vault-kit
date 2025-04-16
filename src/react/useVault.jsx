import React, { useEffect, useMemo, useState } from "react";
import { Vault } from "../class/Vault";

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
            else if (status === "ready" || status === "error") { fallback = undefined; }
        }
        redraw(Symbol());
    });

    vault.get(...a);

    return [ port, cleanUp ];
};


export const useVault = (vault, ...a)=>{
    const redraw = useState(0)[1];

    const [ port, cleanUp ] = useMemo(_=>createPort(vault, redraw, ...a), [vault, ...a]);

    useEffect(_=>cleanUp, [cleanUp]);

    return port;
}



Vault.prototype.use = function (...a) { return useVault(this, ...a); }

