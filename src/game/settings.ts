/** The 15 settings of design.md (Ajustes), with their defaults. */
export interface Settings {
  errors: 'none' | 'conflicts' | 'solution'
  autoCleanNotes: boolean
  digitCounter: boolean
  completedDigits: 'dim' | 'hide'
  inputMode: 'digit-first' | 'cell-first'
  zoneShading: boolean
  digitHighlight: boolean
  timerVisible: boolean
  hintButton: boolean
  autoNotesButton: boolean
  autoPause: boolean
  theme: 'light' | 'dark' | 'system'
  accent: 'indigo' | 'amber' | 'pink' | 'violet' | 'blue' | 'teal' | 'green'
  textSize: 'S' | 'M' | 'L'
  vibration: boolean
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  errors: 'solution',
  autoCleanNotes: true,
  digitCounter: true,
  completedDigits: 'dim',
  inputMode: 'digit-first',
  zoneShading: true,
  digitHighlight: true,
  timerVisible: true,
  hintButton: true,
  autoNotesButton: true,
  autoPause: true,
  theme: 'system',
  accent: 'indigo',
  textSize: 'M',
  vibration: true,
}
