import React, { useEffect, useMemo, useState } from "react";

import useVault from "../../dist/esm/react/index.mjs";
import { client, getEvents, getSnapshot, pushServerUpdate, recordIds, resetDemoData, server, subscribeEvents } from "./test";

const emptyDraft = {
    title:"",
    body:"",
    score:0,
    flagged:false
};

const asDraft = data=>({
    ...emptyDraft,
    ...data,
    score:Number(data?.score ?? 0),
    flagged:Boolean(data?.flagged)
});

const toJson = value=>value === undefined ? "undefined" : JSON.stringify(value, null, 2);
const statusTone = status=>status === "ready" ? "ok" : status === "error" ? "bad" : status === "push" || status === "pull" ? "busy" : status === "expired" ? "warn" : "";

const useEvents = _=>{
    const [events, setEvents] = useState(getEvents);
    useEffect(_=>subscribeEvents(setEvents), []);
    return events;
};

const SnapshotTable = ({ title, snapshot })=>(
    <section className="panel">
        <div className="panel-head">
            <h2>{title}</h2>
        </div>
        <div className="snapshot">
            {recordIds.map(id=>{
                const item = snapshot[id];
                return (
                    <div className="snapshot-row" key={id}>
                        <span className="record-name">{id}</span>
                        <span className={`status ${statusTone(item.status)}`}>{item.status}</span>
                        <span className="snapshot-title">{item.data?.title || "-"}</span>
                        <span className="snapshot-score">{item.data?.score ?? "-"}</span>
                    </div>
                );
            })}
        </div>
    </section>
);

const EventLog = ({ events })=>(
    <section className="panel event-panel">
        <div className="panel-head">
            <h2>Event log</h2>
            <span>{events.length}</span>
        </div>
        <div className="events">
            {events.map(event=>(
                <div className="event-row" key={event.key}>
                    <span>{event.at}</span>
                    <span>{event.source}</span>
                    <span>{event.id}</span>
                    <span className={`status ${statusTone(event.status)}`}>{event.status}</span>
                    <strong>{event.title || event.error || event.origin || "-"}</strong>
                </div>
            ))}
        </div>
    </section>
);

export const VaultView = _=>{
    const events = useEvents();

    const [active, setActive] = useState(recordIds[0]);
    const [busy, setBusy] = useState("");
    const [probe, setProbe] = useState("");

    const activePort = useMemo(_=>client.at(active), [active]);
    const port = useVault(client, [active]);
    const data = port.data;
    const dataKey = toJson(data);

    const [draft, setDraft] = useState(_=>asDraft(data));

    useEffect(_=>{
        setDraft(asDraft(data));
        setProbe("");
    }, [active, dataKey]);

    const clientSnapshot = useMemo(_=>getSnapshot(client), [events, active, dataKey]);
    const serverSnapshot = useMemo(_=>getSnapshot(server), [events, active, dataKey]);

    const run = async (label, fn)=>{
        setBusy(label);
        setProbe("");
        try { await fn(); }
        catch(err) { setProbe(err.message); }
        finally { setBusy(""); }
    };

    const patchDraft = patch=>setDraft(current=>({ ...current, ...patch }));
    const payload = _=>({
        title:draft.title.trim() || "Untitled",
        body:draft.body,
        score:Number(draft.score || 0),
        flagged:draft.flagged
    });

    const isBusy = Boolean(busy) || port.isStatus(["push", "pull"]);

    window.port = port;

    return (
        <main className="app-shell">
            <header className="topbar">
                <div>
                    <p className="eyebrow">@randajan/vault-kit</p>
                    <h1>Vault workbench</h1>
                </div>
                <div className="topbar-stats">
                    <span className={`status ${statusTone(port.status)}`}>{port.status}</span>
                    <span>{active}</span>
                    <span>{busy || "idle"}</span>
                </div>
            </header>

            <section className="workspace">
                <aside className="records panel">
                    <div className="panel-head">
                        <h2>Records</h2>
                    </div>
                    <div className="record-list">
                        {recordIds.map(id=>{
                            const item = clientSnapshot[id];
                            return (
                                <button className={id === active ? "record active" : "record"} key={id} onClick={_=>setActive(id)}>
                                    <span>{id}</span>
                                    <span className={`dot ${statusTone(item.status)}`}></span>
                                    <small>{item.data?.title || item.status}</small>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                <section className="editor panel">
                    <div className="panel-head">
                        <h2>Active vault</h2>
                        <span className={`status ${statusTone(port.status)}`}>{port.status}</span>
                    </div>

                    <div className="form-grid">
                        <label>
                            <span>Title</span>
                            <input value={draft.title} onChange={event=>patchDraft({ title:event.target.value })}/>
                        </label>
                        <label>
                            <span>Score</span>
                            <input type="number" value={draft.score} onChange={event=>patchDraft({ score:event.target.value })}/>
                        </label>
                        <label className="wide">
                            <span>Body</span>
                            <textarea value={draft.body} rows="4" onChange={event=>patchDraft({ body:event.target.value })}/>
                        </label>
                        <label className="toggle">
                            <input type="checkbox" checked={draft.flagged} onChange={event=>patchDraft({ flagged:event.target.checked })}/>
                            <span>Flagged</span>
                        </label>
                    </div>

                    <div className="actions">
                        <button disabled={isBusy} onClick={_=>run("pull", _=>activePort.get())}>Pull</button>
                        <button disabled={isBusy} onClick={_=>run("set", _=>port.set(payload()))}>Set</button>
                        <button disabled={isBusy} onClick={_=>run("act +1", _=>port.act.increment({ step:1 }))}>Act +1</button>
                        <button disabled={isBusy} onClick={_=>run("toggle", _=>port.act.toggle())}>Toggle</button>
                        <button disabled={isBusy} onClick={_=>run("server", _=>pushServerUpdate(active))}>Server event</button>
                        <button disabled={isBusy} onClick={_=>run("timeout", _=>port.act.stall())}>Timeout</button>
                        <button disabled={isBusy} onClick={_=>run("fail", _=>port.act.fail())}>Fail</button>
                        <button disabled={isBusy} onClick={_=>activePort.reset({ origin:"manual-reset" })}>Reset</button>
                        <button disabled={isBusy} onClick={_=>run("has", async _=>setProbe(`has: ${await activePort.has()}`))}>Has</button>
                        <button disabled={isBusy} onClick={_=>run("reset all", resetDemoData)}>Reset all</button>
                    </div>

                    <div className="result-grid">
                        <div>
                            <h3>Data</h3>
                            <pre>{toJson(data)}</pre>
                        </div>
                        <div>
                            <h3>Reply</h3>
                            <pre>{toJson(port.reply)}</pre>
                            <button className="quiet" disabled={port.reply === undefined} onClick={port.confirm}>Confirm reply</button>
                        </div>
                        <div>
                            <h3>Error</h3>
                            <pre>{port.error?.message || probe || "-"}</pre>
                        </div>
                    </div>
                </section>

                <div className="side-stack">
                    <SnapshotTable title="Client cache" snapshot={clientSnapshot}/>
                    <SnapshotTable title="Server vault" snapshot={serverSnapshot}/>
                </div>
            </section>

            <EventLog events={events}/>
        </main>
    );
};
