
export const is = (type, any)=>typeof type === "string" ? (typeof any === type) : (any instanceof type);
export const to = (type, any, errorName, req=false)=>{
    if (is(type, any)) { return any; }
    if (!req && (any == null || !errorName)) { return; }
    throw new TypeError(`Expected ${errorName} to be a '${type}', got '${typeof any}'`);
}




export const toFn = (any, errorName, req=false)=>to("function", any, errorName, req);
export const toObj = (any, errorName, req=false)=>to("object", any, errorName, req);
export const toBol = (any, errorName, req=false)=>to("boolean", any, errorName, req);
export const toStr = (any, errorName, req=false)=>to("string", any, errorName, req);
export const toNum = (any, errorName, req=false)=>to("number", any, errorName, req);
export const toArr = (any, errorName, req=false)=>to(Array, any, errorName, req);

export const toRng = (any, min, max, errorName, req=false)=>{
    const num = toNum(any, errorName, req);
    if (num == null) { return; }
    if (num < min) { throw new Error(`Expected ${errorName} to be greater than '${min}' got '${num}'`); }
    if (num > max) { throw new Error(`Expected ${errorName} to be lesser than '${max}' got '${num}'`); }
    return num;
}


export const toFold = (fold, errorName, req=false)=>{
    const f = toFn(fold);
    if (f) { return f; }
    let prop = toStr(fold, errorName);
    if (prop) { return (r=>[r[prop], r]); }
    if (req) { return (r=>[r, r]); }
}
