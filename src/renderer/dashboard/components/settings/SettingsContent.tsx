import { Outlet } from "react-router";

export default function SettingsContent() {
    // Scrolls on its own, so the sidebar stays put on long pages
    return <div className="grow min-w-0 overflow-y-auto"><Outlet/></div>
}