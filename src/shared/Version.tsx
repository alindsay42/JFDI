declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;

export const APP = { version: __APP_VERSION__, commit: __APP_COMMIT__ };

export function Version() {
  return (
    <footer className="version">
      Version {APP.version} ({APP.commit})
    </footer>
  );
}
