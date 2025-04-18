import slib, { argv } from "@randajan/simple-lib";

const { isBuild } = argv;

slib(isBuild, {
    mode: "web",
    lib:{
        minify:false,
        entries:["index.js", "react/index.js"]
    },
    demo:{
        external:["chalk"],
        loader:{
            ".js":"jsx",
        }
    },
})