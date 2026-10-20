- The executive view has its data file, `content/executive.json`, written in English and neutral Spanish from the
  accepted problem-context research on underground mine ventilation: three headline figures, five sub-tabs (the pain,
  the context, the current situation, the trends, the proposal), four role cards, five approaches of the state of
  the art, the 4 C's, six actions with role owners, and 18 linked sources. It is general: no mine, company or vendor is named.
- The contract test `frontend/src/content/executive.test.ts` checks the file against the shell's schema 2.0.0 and its
  writing limits, the order of the 4 C's, the cause weights, the owners as roles, every cited id and every source,
  the three illustration paths, the flip-card limits in both languages, and that no mine or company is named.
- The three illustration files are drawn by a separate unit; the test checks their paths and captions only.
