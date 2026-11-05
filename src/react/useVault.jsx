import React, { useEffect, useMemo, useState } from "react";
import { Vault } from "../class/Vault";

const validateVault = (vault) => {
    if (!(vault instanceof Vault)) { throw Error("vault must be instance of Vault"); }
};


const createController = (vault, redraw, path=[], autoInit=true) => {
    validateVault(vault);
    const port = vault.at(...path);

    if (port.depth > 0) { throw new Error(`path length must be exactly '${vault.depth}'`); }

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
            else if (status === "ready" || status === "error") { fallback = undefined; }
        }
        redraw(Symbol());
    });

    if (autoInit) { port.get(); }

    return [ ctrl, cleanUp ];
};


export const useVault = (vault, path=[], autoInit=true)=>{
    const redraw = useState(0)[1];

    const [ ctrl, cleanUp ] = useMemo(_=>createController(vault, redraw, path, autoInit), [vault, ...path, autoInit]);

    useEffect(_=>cleanUp, [cleanUp]);

    return ctrl;
}
