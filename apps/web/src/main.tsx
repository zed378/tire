import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.tsx";
import { queryClient } from "./lib/query-client.ts";
import { registerServiceWorker } from "./lib/service-worker.ts";
import "./index.css";

const container = document.getElementById("root");
if (container === null) throw new Error("#root is missing from index.html");

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

// The reason this application is not an Apps Script page: a service worker
// cannot be registered from inside that sandbox (B-08), which made offline work
// impossible however much effort was spent on it.
void registerServiceWorker();
