import SettingsSidebar from "./SettingsSidebar";
import SettingsContent from "./SettingsContent";

export default function Settings() {
    return (
        <div className="flex h-full">
            <SettingsSidebar />
            <SettingsContent />
        </div>
    )
}