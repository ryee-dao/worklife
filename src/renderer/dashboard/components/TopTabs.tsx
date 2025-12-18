import DashboardTab from "./DashboardTab";

export default function TopTabs() {
  return (
    <div className="h-1/10 bg-slate-100">
      <div className="flex flex-row py-2 h-full justify-center align-middle">
        <DashboardTab to="/timer" text="Timer" additionalClassNames="rounded-l-md border-r-1"></DashboardTab>
        <DashboardTab to="/settings" text="Settings" additionalClassNames="rounded-r-md border-l-1"></DashboardTab>
      </div>
    </div>
  );
}
