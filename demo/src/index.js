
import React from "react";
import { createRoot } from 'react-dom/client';

import "./index.css";
import { VaultView } from "./VaultView";
import { Vault } from "../../dist/esm/index.mjs";

const root = document.getElementById("root");

createRoot(root).render(<VaultView/>);

window.vaulter = new Vault({
    depth:3,
});