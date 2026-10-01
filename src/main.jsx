import { createRoot } from "react-dom/client";
import { PreviewHostBridge } from "./components/preview-host-bridge";
import { EngineProvider } from "./engine/EngineProvider";
import App from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró #root");

createRoot(root).render(
  <>
    <PreviewHostBridge />
    <EngineProvider>
      <App />
    </EngineProvider>
  </>,
);
