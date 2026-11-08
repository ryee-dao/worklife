import { useState } from "react";
import { SoundConfigs } from "@main/sound/soundConfigs";
import { playWarningSound } from "@renderer/common/utils/sound";
import SettingsPanel from "./SettingsPanel";

export default function SoundSettings() {
  const [volumePercent, setVolumePercent] = useState(0);

  return (
    <SettingsPanel<SoundConfigs>
      title="Sound Settings"
      isValid
      successMessage="Settings saved successfully"
      load={() => window.electronAPI.loadSoundConfigs()}
      save={(configs) => window.electronAPI.saveSoundConfigs(configs)}
      buildConfig={() => ({ volume: volumePercent / 100 })}
      onLoaded={(configs) => setVolumePercent(Math.round(Math.min(1, Math.max(0, configs.volume)) * 100))}
    >
      <div data-testid="sound-volume" className="tracking-wider p-2">
        <label className="flex items-center gap-3">
          Warning volume
          <input type="range" min={0} max={100} value={volumePercent} className="w-40 accent-blue-400"
            onChange={(e) => setVolumePercent(Number(e.target.value))} />
          <span className="w-10 text-right tabular-nums">{volumePercent}%</span>
        </label>
        <button type="button" onClick={() => playWarningSound(volumePercent / 100)}
          className="mt-3 px-3 py-0.5 border rounded bg-white text-sm cursor-pointer hover:bg-slate-100 active:bg-slate-200">
          Play sound
        </button>
      </div>
    </SettingsPanel>
  );
}
