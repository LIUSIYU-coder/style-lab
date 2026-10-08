import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { buildSession } from './src/core/session.ts';
import { review } from './src/core/srs.ts';
import type { CardState, Grade } from './src/core/srs.ts';
import type { Word } from './src/core/wordlist.ts';
import sampleWords from './data/fixtures/sample-words.json';

// Prototype screen. Uses the sample fixture words and keeps progress in memory only;
// persistence and the real word list come later (see README).
const WORDS = sampleWords as Word[];
const NEW_PER_DAY = 10;

type QueueItem = { card: Word; state: CardState };

const GRADES: { grade: Grade; label: string }[] = [
  { grade: 'again', label: 'Again' },
  { grade: 'hard', label: 'Hard' },
  { grade: 'good', label: 'Good' },
  { grade: 'easy', label: 'Easy' },
];

export default function App() {
  const dark = useColorScheme() === 'dark';
  const colors = useMemo(
    () =>
      dark
        ? { bg: '#111418', fg: '#f2f4f7', sub: '#9aa4b2', card: '#1b2027', accent: '#4f8cff' }
        : { bg: '#f6f7f9', fg: '#14171c', sub: '#5b6572', card: '#ffffff', accent: '#2563eb' },
    [dark],
  );

  const [states, setStates] = useState<Record<string, CardState>>({});
  const [queue, setQueue] = useState<QueueItem[]>(() =>
    buildSession({ words: WORDS, states: {}, now: Date.now(), newPerDay: NEW_PER_DAY, newIntroducedToday: 0 }),
  );
  const [revealed, setRevealed] = useState(false);

  const current = queue[0];

  function answer(grade: Grade) {
    if (!current) return;
    const next = review(current.state, grade, Date.now());
    setStates((prev) => ({ ...prev, [next.id]: next }));
    // A forgotten card comes back at the end of this session; anything else is done.
    setQueue((q) => (grade === 'again' ? [...q.slice(1), { card: current.card, state: next }] : q.slice(1)));
    setRevealed(false);
  }

  function studyAgain() {
    setQueue(
      buildSession({
        words: WORDS,
        states,
        now: Date.now(),
        newPerDay: NEW_PER_DAY,
        newIntroducedToday: Object.keys(states).length,
      }),
    );
    setRevealed(false);
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {current ? (
        <>
          <Text style={[styles.counter, { color: colors.sub }]}>{queue.length} left</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.hanzi, { color: colors.fg }]}>{current.card.hanzi}</Text>
            {revealed ? (
              <>
                <Text style={[styles.pinyin, { color: colors.accent }]}>{current.card.pinyin}</Text>
                <Text style={[styles.meaning, { color: colors.fg }]}>{current.card.meaningEn}</Text>
              </>
            ) : null}
          </View>
          {revealed ? (
            <View style={styles.row}>
              {GRADES.map(({ grade, label }) => (
                <Pressable
                  key={grade}
                  accessibilityRole="button"
                  onPress={() => answer(grade)}
                  style={[styles.gradeButton, { borderColor: colors.accent }]}>
                  <Text style={[styles.gradeText, { color: colors.accent }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setRevealed(true)}
              style={[styles.primary, { backgroundColor: colors.accent }]}>
              <Text style={styles.primaryText}>Show answer</Text>
            </Pressable>
          )}
        </>
      ) : (
        <View style={styles.center}>
          <Text style={[styles.done, { color: colors.fg }]}>All done for now</Text>
          <Pressable
            accessibilityRole="button"
            onPress={studyAgain}
            style={[styles.primary, { backgroundColor: colors.accent }]}>
            <Text style={styles.primaryText}>Check for more</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, paddingTop: 64, paddingBottom: 32, gap: 16 },
  counter: { fontSize: 14, textAlign: 'center' },
  card: { flex: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  hanzi: { fontSize: 72, fontWeight: '600' },
  pinyin: { fontSize: 28 },
  meaning: { fontSize: 20 },
  row: { flexDirection: 'row', gap: 8 },
  gradeButton: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  gradeText: { fontSize: 16, fontWeight: '600' },
  primary: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#ffffff', fontSize: 17, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  done: { fontSize: 24, fontWeight: '600' },
});
