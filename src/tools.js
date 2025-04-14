
export const to = (type, any, errorName, req=false)=>{
    const tp = typeof any;
    if (tp === type) { return any; }
    if (!req && any == null) { return; }
    throw new TypeError(`Expected ${errorName} to be a '${type}', got '${tp}'`);
}


export const toFn = (any, errorName, req=false)=>to("function", any, errorName, req);
export const toObj = (any, errorName, req=false)=>to("object", any, errorName, req);
export const toBol = (any, errorName, req=false)=>to("boolean", any, errorName, req);
export const toStr = (any, errorName, req=false)=>to("string", any, errorName, req);
export const toNum = (any, errorName, req=false)=>to("number", any, errorName, req);

export const toRng = (any, min, max, errorName, req=false)=>{
    const num = toNum(any, errorName, req);
    if (num == null) { return; }
    if (num < min) { throw new Error(`Expected ${errorName} to be greater than '${min}' got '${num}'`); }
    if (num > max) { throw new Error(`Expected ${errorName} to be lesser than '${max}' got '${num}'`); }
    return num;
}