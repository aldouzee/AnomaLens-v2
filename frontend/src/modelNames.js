// Frontend-only display names, keyed by the backend model id: [persona, technique].
export const MODEL_LABELS = {
  random_forest: ["Torvalds", "Random Forest (RF)"],
  bagging: ["Babbage", "Bagging (BG)"],
  boosting: ["Turing", "Boosting (GB)"],
  stacking: ["Ritchie", "Stacking (RF+SVM+GB)"],
  svm: ["Shannon", "Support Vector Machine (SVM)"],
  isolation_forest: ["Dijkstra", "Isolation Forest (IF)"],
  kmeans: ["Hopper", "K-Means (KM)"],
};

/** Short persona name, e.g. "Torvalds". Falls back to the API name or id for unknown models. */
export const personaName = (id, fallback = id) => MODEL_LABELS[id]?.[0] ?? fallback;

/** Full label, e.g. "Torvalds · Random Forest (RF)". */
export const modelLabel = (id, fallback = id) => {
  const l = MODEL_LABELS[id];
  return l ? `${l[0]} · ${l[1]}` : fallback;
};
