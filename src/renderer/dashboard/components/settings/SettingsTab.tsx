import { ComponentType, ReactElement } from "react";
import { NavLink } from "react-router";

interface SettingsTabProps {
    to: string;
    text: string;
    icon: ComponentType<{ className?: string }>
    additionalClassNames?: string;
}

export default function SettingsTab({ to, text, icon: Icon, additionalClassNames = "" }: SettingsTabProps) {
    return (
        <NavLink to={to} className={({ isActive }) => `w-full flex px-3 py-2 ${isActive ? "bg-blue-200" : ""}`}>
            {({ isActive }) => (
                <>
                    <div className={`flex justify-center items-center rounded-sm bg-slate-200 shadow-md h-full aspect-square mr-2 ${isActive ? "text-blue-700" : ""}`}>
                        <Icon className="h-4/5" />
                    </div>
                    <span>{text}</span>
                </>
            )}
        </NavLink>
    )
}