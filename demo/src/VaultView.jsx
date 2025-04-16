
import React from "react";

import useVault from "../../dist/esm/react/index.mjs";
import { local, remote } from "./test";


export const VaultView = props=>{

    const port = useVault(local);

    return (
        <div>{JSON.stringify(port)}</div>
    )
}