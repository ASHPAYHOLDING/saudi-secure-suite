import { createRoot } from "react-dom/client";
import "./i18n";
import App from "./App.tsx";
import "./index.css";

// Global safety net: prevent unhandled promise rejections from crashing the app.
// This is especially important for fetch calls to edge functions that return non-2xx
// responses (e.g., 401 from webhook security tests) — these should never cause a blank screen.
window.addEventListener("unhandledrejection", (event) => {
  console.warn("[unhandledrejection] Caught:", event.reason);
  event.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);
