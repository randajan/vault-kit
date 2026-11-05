import slib, { argv } from "@randajan/simple-lib";

const { isBuild } = argv;

slib(isBuild, {
    port:5005,
    mode: "web",
    lib:{
        minify:false,
        statics:["types"],
        entries:["index.js", "react/index.js"]
    },
    demo:{
        external:["chalk"],
        loader:{
            ".js":"jsx",
        }
    },
})
