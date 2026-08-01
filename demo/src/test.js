import createVault from "../../dist/esm/index.mjs";
import { sleep } from "@randajan/sleep";

export const recordIds = ["alpha", "beta", "gamma"];

const copy = value=>value == null ? value : JSON.parse(JSON.stringify(value));
const now = _=>new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit" });

const defaults = {
    alpha:{
        title:"Alpha brief",
        body:"Cached locally, synced remotely.",
        score:4,
        flagged:false,
        updatedAt:now()
    },
    beta:{
        title:"Beta note",
        body:"Useful for checking multi-record behavior.",
        score:9,
        flagged:true,
        updatedAt:now()
    },
    gamma:{
        title:"Gamma draft",
        body:"Ready for action proxy tests.",
        score:1,
        flagged:false,
        updatedAt:now()
    }
};

const events = [];
const listeners = new Set();

const eventId = _=>`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const messageOf = error=>error?.message || (error ? String(error) : "");

const emitEvent = (source, ctx={}, id="single", origin="")=>{
    events.unshift({
        key:eventId(),
        at:now(),
        source,
        id,
        origin,
        status:ctx.status,
        title:ctx.data?.title,
        score:ctx.data?.score,
        error:messageOf(ctx.error)
    });

    events.splice(40);
    const snapshot = getEvents();
    for (const listener of listeners) { listener(snapshot); }
};

export const getEvents = _=>events.map(copy);

export const subscribeEvents = listener=>{
    listeners.add(listener);
    listener(getEvents());
    return _=>listeners.delete(listener);
};

export const server = window.server = createVault({
    hasMany:true,
    emitter:(emit, ctx, ...args)=>{
        emitEvent("server", ctx, ...args);
        emit(ctx, ...args);
    }
});

for (const id of recordIds) {
    server.set(copy(defaults[id]), id, "seed");
}

const emptyRecord = id=>({
    title:`${id} record`,
    body:"Created on demand.",
    score:0,
    flagged:false,
    updatedAt:now()
});

const saveRecord = (id, patch={})=>({
    ...emptyRecord(id),
    ...copy(server.getData(id)),
    ...copy(patch),
    score:Number(patch.score ?? server.getData(id)?.score ?? 0),
    flagged:Boolean(patch.flagged ?? server.getData(id)?.flagged),
    updatedAt:now()
});

const applyRemoteInput = async (input, id)=>{
    if (!input?.action) { return saveRecord(id, input); }

    const params = input.params || {};
    const current = saveRecord(id);

    if (input.action === "increment") {
        return saveRecord(id, { score:current.score + Number(params.step ?? 1) });
    }

    if (input.action === "toggle") {
        return saveRecord(id, { flagged:!current.flagged });
    }

    if (input.action === "fail") {
        throw new Error("Remote action failed");
    }

    if (input.action === "stall") {
        await sleep(1400);
        throw new Error("Remote operation finished too late");
    }

    throw new Error(`Unknown action '${input.action}'`);
};

export const client = window.client = createVault({
    hasMany:true,
    ttl:6000,
    remote:{
        timeout:900,
        init:set=>{
            const stop = server.on((ctx, id, origin)=>{
                if (ctx.status !== "ready" || origin === "client-push") { return; }
                set(copy(ctx.data), id, "server-event");
            });
            return stop;
        },
        pull:async id=>{
            await sleep(280);
            return copy(server.getData(id) || emptyRecord(id));
        },
        push:async (input, id)=>{
            await sleep(420);
            const record = await applyRemoteInput(input, id);
            await server.set(record, id, "client-push");
            return { record, syncedAt:now() };
        }
    },
    unfold:"record",
    trait:data=>data ? { ...copy(data), cachedAt:now() } : data,
    purge:data=>emitEvent("client", { status:"purge", data }),
    emitter:(emit, ctx, ...args)=>{
        emitEvent("client", ctx, ...args);
        emit(ctx, ...args);
    }
});

export const pushServerUpdate = async id=>{
    const current = saveRecord(id);
    const record = saveRecord(id, {
        title:`${current.title.replace(/\s\([0-9]+\)$/, "")} (${current.score + 1})`,
        score:current.score + 1
    });
    await server.set(record, id, "server-direct");
    return record;
};

export const resetDemoData = async _=>{
    client.resetAll("demo-reset");
    await Promise.all(recordIds.map(id=>server.set(copy(defaults[id]), id, "server-reset")));
};

export const getSnapshot = vault=>recordIds.reduce((out, id)=>{
    out[id] = {
        status:vault.getStatus(id),
        data:vault.getData(id),
        error:messageOf(vault.getError(id))
    };
    return out;
}, {});

window.demo = {
    client,
    server,
    recordIds,
    getEvents,
    getClientSnapshot:_=>getSnapshot(client),
    getServerSnapshot:_=>getSnapshot(server),
    pushServerUpdate,
    resetDemoData
};
