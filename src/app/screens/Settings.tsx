import { useCallback, useRef, useState } from 'react'
import type { Settings as SettingsT } from '../../game/settings'
import type { Backup } from '../../storage/backup'
import { clearHistory } from '../../storage/db'
import type { Layout } from '../layout'
import { useStore } from '../store'
import { Dialog, PageHeader } from '../ui'

type Option<K extends keyof SettingsT> = { value: SettingsT[K]; label: string }

const ACCENTS: { value: SettingsT['accent']; label: string; dark: string; light: string }[] = [
  { value: 'indigo', label: 'Indigo', dark: '#8C95F6', light: '#4B55C4' },
  { value: 'amber', label: 'Amber', dark: '#E6A63B', light: '#8A5A00' },
  { value: 'pink', label: 'Rose', dark: '#EC7FA9', light: '#AD3A6C' },
  { value: 'violet', label: 'Violet', dark: '#A99BF5', light: '#6450C0' },
  { value: 'blue', label: 'Blue', dark: '#6FB1F2', light: '#23609F' },
  { value: 'teal', label: 'Teal', dark: '#4FC7B4', light: '#17766A' },
  { value: 'green', label: 'Green', dark: '#8CCB6E', light: '#3B7327' },
]

interface Bound {
  settings: SettingsT
  update: (patch: Partial<SettingsT>) => void
}

function Segment<K extends keyof SettingsT>({ k, label, options, help, settings, update }: { k: K; label: string; options: Option<K>[]; help?: string } & Bound) {
  return (
    <div className="setting column">
      <div className="setting-text">
        <span id={`s-${k}`}>{label}</span>
        {help && <span className="muted small">{help}</span>}
      </div>
      <div className="segment" role="group" aria-labelledby={`s-${k}`}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={settings[k] === o.value}
            className={settings[k] === o.value ? 'on' : ''}
            onClick={() => update({ [k]: o.value } as Partial<SettingsT>)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Toggle({ k, label, help, settings, update }: { k: keyof SettingsT; label: string; help?: string } & Bound) {
  const on = settings[k] === true
  return (
    <div className="setting">
      <div className="setting-text">
        <span>{label}</span>
        {help && <span className="muted small">{help}</span>}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className={on ? 'switch on' : 'switch'} onClick={() => update({ [k]: !on } as Partial<SettingsT>)}>
        <span />
      </button>
    </div>
  )
}

type Pending =
  | { kind: 'import'; name: string; backup: Backup }
  | { kind: 'invalid' }
  | { kind: 'clear' }
  | null

export function Settings({ layout, dark }: { layout: Layout; dark: boolean }) {
  const store = useStore()
  const { settings, updateSettings } = store
  const [pending, setPending] = useState<Pending>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const close = useCallback(() => setPending(null), [])
  const bound: Bound = { settings, update: updateSettings }

  const exportData = async () => {
    const { createBackup } = await import('../../storage/backup')
    const { filename, json } = await createBackup(store.db)
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    const { parseBackup } = await import('../../storage/backup')
    const parsed = parseBackup(await file.text())
    setPending(parsed.ok ? { kind: 'import', name: file.name, backup: parsed.backup } : { kind: 'invalid' })
  }

  const doImport = async (mode: 'merge' | 'replace') => {
    if (pending?.kind !== 'import') return
    const { importBackup } = await import('../../storage/backup')
    await importBackup(store.db, pending.backup, mode)
    setPending(null)
    await store.reload()
  }

  const doClear = async () => {
    await clearHistory(store.db)
    setPending(null)
    await store.reload()
  }

  const summary =
    pending?.kind === 'import' ? { games: pending.backup.games.length, history: pending.backup.history.length } : null

  return (
    <main className={`page settings page-${layout.kind}`}>
      <PageHeader title="Settings" back={!layout.sidebar} />
      <section className="list">
        <h2 className="section-title">GAMEPLAY</h2>
        <Segment
          {...bound}
          k="errors"
          label="Mistakes"
          help="Conflicts: repeats in a row, column or box. Solution: anything that is not the answer."
          options={[
            { value: 'none', label: 'Off' },
            { value: 'conflicts', label: 'Conflicts' },
            { value: 'solution', label: 'Solution' },
          ]}
        />
        <Segment
          {...bound}
          k="inputMode"
          label="Input"
          options={[
            { value: 'digit-first', label: 'Number first' },
            { value: 'cell-first', label: 'Cell first' },
          ]}
        />
        <Toggle {...bound} k="autoCleanNotes" label="Auto-clean notes" help="Placing a number removes it from notes in its row, column and box." />
        <Toggle {...bound} k="hintButton" label="Hint button" />
        <Toggle {...bound} k="autoNotesButton" label="Fill notes button" />
        <Toggle {...bound} k="autoPause" label="Pause when leaving" help="Switching tab or locking the phone pauses the clock." />
      </section>
      <section className="list">
        <h2 className="section-title">DISPLAY</h2>
        <Segment
          {...bound}
          k="theme"
          label="Theme"
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ]}
        />
        <div className="setting column">
          <span id="s-accent">Accent</span>
          <div className="swatches" role="radiogroup" aria-labelledby="s-accent">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                type="button"
                role="radio"
                aria-checked={settings.accent === a.value}
                aria-label={a.label}
                title={a.label}
                className={settings.accent === a.value ? 'accent-swatch on' : 'accent-swatch'}
                style={{ background: dark ? a.dark : a.light }}
                onClick={() => updateSettings({ accent: a.value })}
              />
            ))}
          </div>
        </div>
        <Segment
          {...bound}
          k="textSize"
          label="Number size"
          options={[
            { value: 'S', label: 'S' },
            { value: 'M', label: 'M' },
            { value: 'L', label: 'L' },
          ]}
        />
        <Segment
          {...bound}
          k="completedDigits"
          label="Completed digits"
          options={[
            { value: 'dim', label: 'Dim' },
            { value: 'hide', label: 'Hide' },
          ]}
        />
        <Toggle {...bound} k="digitCounter" label="Digit counter" />
        <Toggle {...bound} k="zoneShading" label="Zone shading" />
        <Toggle {...bound} k="digitHighlight" label="Digit highlight" />
        <Toggle {...bound} k="timerVisible" label="Show timer" help="The clock keeps running when hidden." />
        {/* Hidden where the browser has no vibrate. Firefox for Android keeps it but never vibrates. */}
        {'vibrate' in navigator && (
          <Toggle {...bound} k="vibration" label="Vibration" help="On placing a number and on mistakes. Not supported by Firefox or on iPhone." />
        )}
      </section>
      <section className="stack">
        <h2 className="section-title">DATA</h2>
        <div className="two">
          <button type="button" className="btn outline" onClick={() => void exportData()}>
            Export
          </button>
          <button type="button" className="btn outline" onClick={() => fileInput.current?.click()}>
            Import
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void pickFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <button type="button" className="btn danger" onClick={() => setPending({ kind: 'clear' })}>
          Clear history
        </button>
      </section>

      {pending?.kind === 'import' && summary && (
        <Dialog
          title="Import data"
          sheet={layout.sheet}
          onCancel={close}
          actions={[
            { label: 'Cancel', kind: 'ghost', onClick: close },
            { label: 'Replace', kind: 'danger', onClick: () => void doImport('replace') },
            { label: 'Merge', kind: 'primary', onClick: () => void doImport('merge') },
          ]}
        >
          <div className="file-card">
            <span className="strong">{pending.name}</span>
            <span className="muted small">
              {summary.history} solved · {summary.games} in progress · settings
            </span>
          </div>
          <p>Merge keeps everything from both. Replace deletes the data on this device first.</p>
        </Dialog>
      )}
      {pending?.kind === 'invalid' && (
        <Dialog title="Can’t import this file" sheet={layout.sheet} onCancel={close} actions={[{ label: 'OK', kind: 'primary', onClick: close }]}>
          <p>It isn’t a nona backup, or it was made by a newer version of nona. Nothing on this device was changed.</p>
        </Dialog>
      )}
      {pending?.kind === 'clear' && (
        <Dialog
          title="Clear history?"
          sheet={layout.sheet}
          onCancel={close}
          actions={[
            { label: 'Cancel', kind: 'ghost', onClick: close },
            { label: 'Clear history', kind: 'danger-solid', onClick: () => void doClear() },
          ]}
        >
          <p>
            Deletes {store.history.length} solved {store.history.length === 1 ? 'puzzle' : 'puzzles'}, {store.games.length}{' '}
            {store.games.length === 1 ? 'game' : 'games'} in progress and your best times on this device. Your settings are kept. Export first if you want a copy.
          </p>
        </Dialog>
      )}
    </main>
  )
}
