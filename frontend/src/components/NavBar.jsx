import AMIcon from "../assets/logos/anomalens_logo.svg";

const TABS = [
  ["dashboard", "Dashboard"],
  ["compare", "Model comparison"],
  ["about", "About"],
];

export default function NavBar({ tab, onNavigate }) {
  return (
    <header className="shell">
      <div className="shell-brand">
        <img src={AMIcon} alt="AnomaLens" />
        <b className="logo_name">ANOMA<span className="logo_accent">LENS</span></b>
      </div>
      <div className="shell-tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? "on" : ""} onClick={() => onNavigate(id)}>{label}</button>
        ))}
      </div>
    </header>
  );
}
