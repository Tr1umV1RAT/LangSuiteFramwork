import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { useAppStore } from "./store";

const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
if (typeof window !== "undefined" && search?.get("e2e") === "1") {
  (window as typeof window & { __LANGSUITE_STORE__?: typeof useAppStore }).__LANGSUITE_STORE__ = useAppStore;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
