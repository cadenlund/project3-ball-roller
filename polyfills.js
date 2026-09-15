// three's CommonJS entry calls process.emitWarning at load; Hermes has a
// process object but not that function, which crashes the app before startup.
// Must be imported before anything that (transitively) requires three.
if (typeof process !== 'undefined' && typeof process.emitWarning !== 'function') {
  process.emitWarning = () => {};
}
