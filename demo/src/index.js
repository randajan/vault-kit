
import createVault from "../../dist/esm/index.mjs";

const sleep = async ms=>new Promise(res=>setTimeout(res, ms));

const remote = window.remote = createVault(true, {
    react:(id, req)=>{
        console.log({req});
        const { action, content } = req;
        const data = action === "write" ? content : action === "rnd" ? Math.random() : null;
        return [data, {isOk:true, data}];
    },
    emitter:(emit, id, ctx, ...args)=>{
        if (ctx.status === "ready") { emit(id, ctx, ...args); }
    }
});

const local = window.local = createVault(false, {
    act:(res)=>{
        console.log({res});
        const { isOk, data } = res;
        return [data, res];
    },
    emitter:(emit, ctx, ...args)=>{
        if (ctx.status !== "ready") { return; }
        ctx.same = ctx.to === ctx.from;
        emit(ctx, ...args);
    },
    remote:{
        pull:async _=>{
            console.log("LOCAL-PULL");
            return sleep(2000).then(_=>remote.get("foo"));
        },
        push:async (data)=>{
            console.log("LOCAL-PUSH", data);
            return sleep(2000).then(_=>remote.set("foo", data));
        },
        init:set=>{
            remote.on((id, {status, to, from})=>{
                console.log("LOCAL DBG=", id, to);
                if (id === "foo") { set(to); }
            });
        }
    }
});




setInterval(_=>{    
    remote.set("foo", {action:"rnd"});
}, 3000);

remote.on((...a)=>console.log("REMOTE", ...a));
local.on((...a)=>console.log("LOCAL", ...a));
