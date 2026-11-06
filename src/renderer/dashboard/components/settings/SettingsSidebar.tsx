import SettingsTab from "./SettingsTab";
import { ClockAlert, Clock9, Gauge, Briefcase, Wrench } from 'lucide-react';
import { IS_DEV } from "@renderer/common/constants";


export default function SettingsSidebar() {
  return <div className="flex flex-col shrink-0 w-2/5 sm:w-1/5 py-3 bg-slate-200">
    <h3 className="font-bold tracking-wide md:tracking-widest pl-1">CONFIGS</h3>
    <SettingsTab to="/settings/timer" text="Timer" icon={Clock9} />
    <SettingsTab to="/settings/workday" text="Workday" icon={Briefcase} />
    <SettingsTab to="/settings/difficulty" text="Difficulty" icon={Gauge} />
    <SettingsTab to="/settings/overdue" text="Overdue" icon={ClockAlert} />
    {IS_DEV && <SettingsTab to="/settings/admin" text="Admin" icon={Wrench} />}
  </div>
}
