/**
 * Espelha o payload de transcrição usado pelo demo (ficheiros em
 * media/transcriptions/&lt;trackId&gt;/) + campos de runtime em MusicAiDemoPayload.
 */

export interface TranscriptionChordEvent {
  start: number;
  end: number;
  start_bar: number;
  start_beat: number;
  end_bar: number;
  end_beat: number;
  chord_majmin: string;
  bass: string | null;
  bass_nashville: string | null;
  chord_complex_jazz: string;
  chord_simple_jazz: string;
  chord_basic_jazz: string;
  chord_complex_pop: string;
  chord_simple_pop: string;
  chord_basic_pop: string;
  chord_complex_nashville: string;
  chord_simple_nashville: string;
  chord_basic_nashville: string;
}

export interface TranscriptionLyricSyllable {
  syllable: string;
  start: number;
  end: number;
}

export interface TranscriptionLyricWord {
  word: string;
  start?: number;
  end?: number;
  syllables?: TranscriptionLyricSyllable[];
}

export interface TranscriptionLyricSegment {
  start?: number;
  end?: number;
  text?: string;
  language?: string;
  words?: TranscriptionLyricWord[];
}

/**
 * Letras por origem: `ai` (AI/lyrics.json) e `match` (Match/lyrics.json, alinhamento por busca).
 * Qualquer chave pode estar ausente se essa variante não existir.
 */
export interface TranscriptionLyricsVariants {
  ai?: TranscriptionLyricSegment[];
  match?: TranscriptionLyricSegment[];
}

export interface TranscriptionSection {
  start: number;
  end: number;
  label: string;
}

export interface MusicTranscriptionMeta {
  id?: string;
  name?: string;
  sourcePathParam?: string;
  trackId?: string;
  lyricsVariant?: string;
  audioUrl?: string;
  duration_seconds?: number;
}

/**
 * Objeto da música / payload de transcrição (equivalente a MusicAiDemoPayload
 * com tipos de acorde e letra alinhados ao export JSON atual).
 */
export interface MusicTranscriptionPayload {
  chords?: TranscriptionChordEvent[];
  /** @deprecated Preferir `lyricsVariants`. Se enviado sem `lyricsVariants`, a API trata como `match`. */
  lyrics?: TranscriptionLyricSegment[];
  lyricsVariants?: TranscriptionLyricsVariants;
  sections?: TranscriptionSection[];
  meta?: MusicTranscriptionMeta;
  chordTimeOffsetSec?: number;
}
