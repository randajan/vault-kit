
export const to = (type, any, errorName)=>{
    if (typeof any === type) { return any; }
    if (!errorName && any == null) { return; }
    throw new TypeError(`Expected ${errorName} to be a ${type}, got ${typeof any}`);
}


export const toFn = (any, errorName)=>to("function", any, errorName);
export const toObj = (any, errorName)=>to("object", any, errorName);
export const toBol = (any, errorName)=>to("boolean", any, errorName);
export const toStr = (any, errorName)=>to("string", any, errorName);

const toFnx = (hasId, any, errorName)=>{
    const fn = toFn(any, errorName);
    return (!fn || hasId) ? fn : (id, ...args)=>fn(...args);
}

const formatRemote = (hasId, remote)=>{
    remote = toObj(remote);
    if (!remote) { return; }

    const init = remote.init = toFn(remote.init);           //(set)=>{ set(); }
    remote.push = toFnx(hasId, remote.push);                //(id, data)=>data;
    remote.pull = toFn(remote.pull, "option.remote.pull");  //(id)=>data;

    if (!hasId && init) {
        remote.init = (set)=>init((...args)=>set(undefined, ...args));
    }

    return remote;
}

export const formatOpt = (hasId, opt={})=>{
    opt = toObj(opt) || {};

    const remote = opt.remote = formatRemote(hasId, opt.remote);

    opt.name = toStr(opt.name) || "Vault";
    opt.readonly = (remote && !remote.push) || toBol(opt.readonly) || false;

    opt.act = toFnx(hasId, opt.act);
    opt.react = toFnx(hasId, opt.react);
    const emitter = opt.emitter = toFn(opt.emitter);
    
    if (!hasId && emitter) { opt.emitter = (emit, id, ...args)=>emitter(emit, ...args); }

    return opt;
}