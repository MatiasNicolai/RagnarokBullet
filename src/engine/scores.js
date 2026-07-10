// Local high-score table (localStorage). Top entries with 3-letter arcade
// initials, character, difficulty and whether the run cleared the campaign.
const KEY = 'rbh_scores_v1';
const MAX = 8;

export function loadScores() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function qualifies(score) {
  const list = loadScores();
  return list.length < MAX || score > list[list.length - 1].score;
}

export function submitScore(entry) {
  const list = loadScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(top)); } catch { /* ignore */ }
  return top.indexOf(entry);
}
