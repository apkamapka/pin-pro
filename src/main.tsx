import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNativePlugins } from "./lib/capacitor.ts";

// Bootstrap native plugins (no-op on web)
initNativePlugins();

createRoot(document.getElementById("root")!).render(<App />);
