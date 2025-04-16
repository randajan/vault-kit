
import React from "react";
import { createRoot } from 'react-dom/client';

import "./index.css";
import { VaultView } from "./VaultView";

const root = document.getElementById("root");

createRoot(root).render(<VaultView/>);

