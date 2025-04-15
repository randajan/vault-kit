
import createVault from "../../dist/esm/index.mjs";

const sleep = async ms=>new Promise(res=>setTimeout(res, ms));

const remote = window.remote = createVault({
    ttl:30000,
    hasMany:true,
    emitter:(emit, ctx, ...args)=>{
        console.log("REMOTE", ctx.status, ctx, ...args);
        if (ctx.status !== "ready" && ctx.status !== "expired") { return; }
        emit(ctx, ...args);
    },
    reactions:{
        rnd:(exp)=>Math.random()*exp,
        write:(data)=>data
    },
    onRequest:data=>[data, {data, isOk:true}]
});

const local = window.local = createVault({
    ttl:10000,
    remote:{
        timeout:2000,
        pull:async _=>{
            console.log("LOCAL-PULL");
            return sleep(1000).then(_=>remote.get("foo"));
        },
        push:async (data)=>{
            console.log("LOCAL-PUSH", data);
            return sleep(3000).then(_=>remote.set(data, "foo"));
        },
        init:set=>{
            remote.on(({status, data}, id)=>{
                console.log("LOCAL DBG=", id, data);
                if (id === "foo") { set(data); }
            });
        }
    },
    emitter:(emit, ctx, ...args)=>{
        console.log("LOCAL", ctx.status, ctx, ...args);
        if (ctx.status !== "ready") { return; }
        const same = ctx.to === ctx.from;
        if (!same) { emit(ctx, ...args); }
    },
    onResponse:"data"
});




// setInterval(_=>{    
//     remote.set({action:"rnd"}, "foo");
// }, 3000);

// remote.on((...a)=>console.log("REMOTE", ...a));
// local.on((...a)=>console.log("LOCAL", ...a));
