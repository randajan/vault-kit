
import createVault from "../../dist/esm/index.mjs";

const sleep = async ms=>new Promise(res=>setTimeout(res, ms));

const remote = window.remote = createVault({
    hasMany:true,
    onRequest:(req, id)=>{
        console.log("REQUEST", {req});
        const { action, content } = req;
        const data = action === "write" ? content : action === "rnd" ? Math.random() : null;
        return [data, {isOk:true, data}]; //this is response
    },
    emitter:(emit, ctx, ...args)=>{
        if (ctx.status === "ready") { emit(ctx, ...args); }
    }
});

const local = window.local = createVault({
    readonly:true,
    onResponse:(res)=>{ //here comes response
        console.log({res});
        const { data } = res;
        return [data, res];
    },
    emitter:(emit, ctx, ...args)=>{
        if (ctx.status !== "ready") { return; }
        const same = ctx.to === ctx.from;
        if (!same) { emit(ctx, ...args); }
    },
    remote:{
        pull:async _=>{
            console.log("LOCAL-PULL");
            return sleep(2000).then(_=>remote.get("foo"));
        },
        push:async (data)=>{
            console.log("LOCAL-PUSH", data);
            return sleep(2000).then(_=>remote.set(data, "foo"));
        },
        init:set=>{
            remote.on(({status, to, from, id})=>{
                console.log("LOCAL DBG=", id, to);
                if (id === "foo") { set(to); }
            });
        }
    }
});




// setInterval(_=>{    
//     remote.set({action:"rnd"}, "foo");
// }, 3000);

remote.on((...a)=>console.log("REMOTE", ...a));
local.on((...a)=>console.log("LOCAL", ...a));
