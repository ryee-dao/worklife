import SettingsTab from "./SettingsTab";
import { ClockIcon, HandRaisedIcon } from "@heroicons/react/24/solid";


export default function SettingsSidebar() {
    return <div className="flex flex-col w-1/5 py-3 bg-slate-100">
        <h3 className="font-bold tracking-wider">SETTINGS</h3>
        <SettingsTab to="/settings/time" text="Time" Icon={ClockIcon}/>
        <SettingsTab to="/settings/limits" text="Limits" Icon={HandRaisedIcon}/>

    </div>
}