import React from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./auth.jsx";
import GoldChitPlanner from "./GoldChitPlanner.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <GoldChitPlanner />
    </AuthProvider>
  </React.StrictMode>
);
