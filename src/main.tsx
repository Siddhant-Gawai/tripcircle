import React from "react";
import { createRoot } from "react-dom/client";
import PublicApp from "./PublicShell";
import "./style.css";
import "./public.css";
createRoot(document.getElementById("root")!).render(<PublicApp />);
