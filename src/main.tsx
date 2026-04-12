import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Copyright notice
console.log(
  "%c🚀 Zuup Auth",
  "color: #EC4899; font-size: 24px; font-weight: bold;"
);
console.log(
  "%cCopyright © 2026 Zuup\nMade by Jagrit Sachdev",
  "color: #94A3B8; font-size: 12px;"
);
console.log(
  "%c⚠️ Warning: Do not paste any code here unless you know what you're doing!",
  "color: #F59E0B; font-size: 14px; font-weight: bold;"
);

createRoot(document.getElementById("root")!).render(<App />);
