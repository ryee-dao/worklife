import SettingsTab from "./SettingsTab";
// import { ClockIcon, HandRaisedIcon } from "@heroicons/react/24/solid";
import { ClockAlert, Clock9, ShieldMinus } from 'lucide-react';


export default function SettingsSidebar() {
  return <div className="flex flex-col w-2/5 sm:w-1/5 py-3 bg-slate-200">
    <h3 className="font-bold tracking-wide md:tracking-widest pl-1">CONFIG</h3>
    <SettingsTab to="/settings/timer" text="Timer" icon={Clock9} />
    <SettingsTab to="/settings/limits" text="Limits" icon={ShieldMinus} />
    <SettingsTab to="/settings/overdue" text="Overdue" icon={ClockAlert} />
  </div>
}