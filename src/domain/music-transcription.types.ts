/**
 * Espelha o payload de transcrição usado pelo demo (ficheiros em
 * media/transcriptions/&lt;trackId&gt;/) + campos de runtime em MusicAiDemoPayload.
 */

export type LyricsSource = 'AI' | 'MATCH';

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
  audioUrl?: string;
  duration_seconds?: number;
}

/**
 * Objeto da música / payload de transcrição (equivalente a MusicAiDemoPayload
 * com tipos de acorde e letra alinhados ao export JSON atual).
 */
export interface MusicTranscriptionPayload {
  chords?: TranscriptionChordEvent[];
  lyrics?: TranscriptionLyricSegment[];
  lyricsSource?: LyricsSource;
  sections?: TranscriptionSection[];
  meta?: MusicTranscriptionMeta;
  chordTimeOffsetSec?: number;
}
