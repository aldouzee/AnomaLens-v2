import { lazy, Suspense, useEffect, useState } from "react";
import { getModels } from "./api/client.js";
import NavBar from "./components/NavBar.jsx";

// Pages load on demand so the charting library stays out of the initial bundle.
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const ModelComparison = lazy(() => import("./pages/ModelComparison.jsx"));
const About = lazy(() => import("./pages/About.jsx"));

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
      <NavBar tab={tab} onNavigate={setTab} />
      <main className="page">
        {error && tab !== "about" && <div className="banner bad">Cannot reach the API: {error}. Is the backend running and are models trained?</div>}
        <Suspense fallback={<p className="muted">Loading…</p>}>
          {tab === "dashboard" && <Dashboard {...props} />}
          {tab === "compare" && <ModelComparison {...props} />}
          {tab === "about" && <About info={info} onNavigate={setTab} />}
        </Suspense>
      </main>
    </>
  );
}
