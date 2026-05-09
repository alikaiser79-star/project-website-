import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { BookingProvider } from "./context/BookingContext.jsx";
import { UIProvider } from "./context/UIContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <BookingProvider>
          <UIProvider>
            <App />
          </UIProvider>
        </BookingProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>
);
