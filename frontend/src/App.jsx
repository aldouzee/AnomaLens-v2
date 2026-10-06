import { useEffect, useState } from "react";
import { getModels } from "./api/client.js";
import Dashboard from "./pages/Dashboard.jsx";
import ModelComparison from "./pages/ModelComparison.jsx";
import About from "./pages/About.jsx";

const TABS = [
  ["dashboard", "Dashboard"],
  ["compare", "Model comparison"],
  ["about", "About"],
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [info, setInfo] = useState(null); // { features, models, dataset }
  const [error, setError] = useState(null);

  useEffect(() => {
    getModels().then(setInfo).catch((e) => setError(e.message));
  }, []);

  const props = { info, error };
  return (
    <>
      <header className="shell">
        <b className="shell-logo">ANOMA<span>LENS</span></b>
        <div className="shell-tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      </header>
      <main className="page">
        {error && tab !== "about" && <div className="banner bad">Cannot reach the API: {error}. Is the backend running and are models trained?</div>}
        {tab === "dashboard" && <Dashboard {...props} />}
        {tab === "compare" && <ModelComparison {...props} />}
        {tab === "about" && <About onNavigate={setTab} />}
      </main>
    </>
  );
}
