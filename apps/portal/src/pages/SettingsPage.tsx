import { KeymapEditor } from '../components/KeymapEditor.js';
import type { PortalSettings } from '../lib/settings.js';
import type { I18n } from '../lib/i18n.js';

interface Props {
  i18n: I18n;
  settings: PortalSettings;
  onChange(patch: Partial<PortalSettings>): void;
}

function Slider({
  label, value, onChange,
}: { label: string; value: number; onChange(v: number): void }): JSX.Element {
  return (
    <label className="nastaveni__polozka">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <span className="tabular nastaveni__hodnota">{Math.round(value * 100)} %</span>
    </label>
  );
}

function Switch({
  label, help, checked, onChange,
}: { label: string; help?: string; checked: boolean; onChange(v: boolean): void }): JSX.Element {
  return (
    <label className="nastaveni__polozka nastaveni__polozka--prepinac">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {help && <small>{help}</small>}
      </span>
    </label>
  );
}

export function SettingsPage({ i18n, settings, onChange }: Props): JSX.Element {
  return (
    <div className="nastaveni">
      <h1>{i18n.t('settings.title')}</h1>

      <section>
        <h2>{i18n.t('settings.audio')}</h2>
        <Switch
          label={i18n.locale === 'cs' ? 'Ztlumit vše' : 'Mute everything'}
          checked={settings.muted}
          onChange={(muted) => onChange({ muted })}
        />
        <Slider
          label={i18n.t('settings.music')}
          value={settings.music}
          onChange={(music) => onChange({ music })}
        />
        <Slider
          label={i18n.t('settings.sfx')}
          value={settings.sfx}
          onChange={(sfx) => onChange({ sfx })}
        />
      </section>

      <section>
        <h2>{i18n.t('settings.accessibility')}</h2>
        <Switch
          label={i18n.t('settings.reducedMotion')}
          checked={settings.reducedMotion}
          onChange={(reducedMotion) => onChange({ reducedMotion })}
        />
        <Switch
          label={i18n.t('settings.colorblind')}
          help={i18n.t('settings.colorblindHelp')}
          checked={settings.colorblind}
          onChange={(colorblind) => onChange({ colorblind })}
        />
        <Switch
          label={i18n.t('settings.lowQuality')}
          help={i18n.t('settings.lowQualityHelp')}
          checked={settings.lowQuality}
          onChange={(lowQuality) => onChange({ lowQuality })}
        />
        <Switch
          label={i18n.t('settings.leftHanded')}
          checked={settings.leftHanded}
          onChange={(leftHanded) => onChange({ leftHanded })}
        />
      </section>

      <section>
        <h2>{i18n.t('settings.controls')}</h2>
        <KeymapEditor
          keymap={settings.keymap}
          onChange={(keymap) => onChange({ keymap })}
        />
      </section>

      <section>
        <h2>{i18n.t('settings.language')}</h2>
        <div className="nastaveni__jazyky">
          <a
            className={`tlacitko ${i18n.locale === 'cs' ? 'tlacitko--hlavni' : ''}`}
            href="/cs/nastaveni"
          >
            Čeština
          </a>
          <a
            className={`tlacitko ${i18n.locale === 'en' ? 'tlacitko--hlavni' : ''}`}
            href="/en/nastaveni"
          >
            English
          </a>
        </div>
      </section>
    </div>
  );
}
