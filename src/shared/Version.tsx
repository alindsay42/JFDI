declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;

export function Version() {
  return (
    <footer className="version">
      Version {__APP_VERSION__} ({__APP_COMMIT__})
    </footer>
  );
}
