import { NavLink } from "react-router";

interface DashboardTabProps {
  to: string;
  text: string;
  additionalClassNames?: string;
}

export default function DashboardTab({
  to,
  text,
  additionalClassNames = "",
}: DashboardTabProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex justify-center items-center self-stretch w-1/4 border-2 hover:bg-slate-300 border-slate-200 ${additionalClassNames} ${
          isActive ? "bg-slate-200 inset-shadow-sm" : ""
        }`
      }
    >
      <span className="text-slate-800 text-[10px] sm:text-base md:text-xl lg:text-3xl font-semibold tracking-normal sm:tracking-widest">{text}</span>
    </NavLink>
  );
}
