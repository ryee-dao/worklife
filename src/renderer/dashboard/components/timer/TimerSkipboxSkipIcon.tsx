import { ForwardIcon } from "@heroicons/react/24/outline";
interface TimerSkipboxSkipIconProps {
    slashed: boolean
}

export default function TimerSkipboxSkipIcon({ slashed }: TimerSkipboxSkipIconProps) {
    return (
        <div className={`relative self-center rounded-full h-4/5 lg:h-5/6 aspect-square border sm:border-2 ${slashed ? 'bg-slate-200' : 'bg-blue-200'}`}>
            <ForwardIcon className={`h-4/5 mt-0.5 ml-0.5 md:ml-1 ${slashed ? 'text-slate-800' : 'text-blue-800'}`} />
            {
                slashed &&
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-full h-0.5 bg-current rotate-135`} />
                </div>
            }
        </div>
    )
}