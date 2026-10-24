import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
class ErrorBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { error: false };
  }
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="login">
        <section className="card">
          <h1>No pudimos mostrar esta pantalla</h1>
          <p>Tus datos están guardados. Recarga para volver a intentarlo.</p>
          <button onClick={() => location.reload()}>Recargar</button>
        </section>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
