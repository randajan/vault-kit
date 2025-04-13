
export const to = (type, any, errorName)=>{
    if (typeof any === type) { return any; }
    if (!errorName && any == null) { return; }
    throw new TypeError(`Expected ${errorName} to be a ${type}, got ${typeof any}`);
}


export const toFn = (any, errorName)=>to("function", any, errorName);
export const toObj = (any, errorName)=>to("object", any, errorName);
export const toBol = (any, errorName)=>to("boolean", any, errorName);
export const toStr = (any, errorName)=>to("string", any, errorName);

const toFnx = (hasMany, any, errorName)=>{
    const fn = toFn(any, errorName);
    return (!fn || hasMany) ? fn : (data, id, ...args)=>fn(data, ...args);
}

const formatRemote = (hasMany, remote)=>{
    remote = toObj(remote);
    if (!remote) { return; }

    const init = remote.init = toFn(remote.init);           //(set)=>{ set(); }
    remote.push = toFnx(hasMany, remote.push);                //(data, id)=>data;
    remote.pull = toFn(remote.pull, "option.remote.pull");  //(id)=>data;

    if (!hasMany && init) { remote.init = set=>init(toFnx(hasMany, set)); }

    return remote;
}

export const formatOpt = (hasMany, opt={})=>{
    opt = toObj(opt) || {};

    const remote = opt.remote = formatRemote(hasMany, opt.remote);

    opt.hasMany = hasMany;
    opt.name = toStr(opt.name) || "Vault";
    opt.readonly = (remote && !remote.push) || toBol(opt.readonly) || false;

    opt.onRequest = toFnx(hasMany, opt.onRequest);
    opt.onResponse = toFnx(hasMany, opt.onResponse);
    opt.emitter = toFn(opt.emitter);

    return opt;
}