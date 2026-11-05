import SettingsSidebar from "./SettingsSidebar";
import SettingsContent from "./SettingsContent";

export default function Settings() {
    return (
        <div className="flex grow min-h-0">
            <SettingsSidebar />
            <SettingsContent />
        </div>
    )
}