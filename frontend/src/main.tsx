import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "@/context/AuthContext";
import { RealtimeProvider } from "@/context/RealtimeContext";
import RealtimeToasts from "@/components/RealtimeToasts";
import OutboxBar from "@/components/OutboxBar";
createRoot(document.getElementById("root")!).render(
  <StrictMode><BrowserRouter><AuthProvider><RealtimeProvider><App /><RealtimeToasts /><OutboxBar /></RealtimeProvider></AuthProvider></BrowserRouter></StrictMode>
);
