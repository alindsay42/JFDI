/** Each returns its input unchanged when it's already the current version, or isn't that kind of file. */
export function upgradeProgramme<T>(p: T): T;
export function upgradeLog<T>(log: T): T;
export function upgradeBackup<T>(backup: T): T;
/** One logged session: converts its prescription and slot paths when it was saved by programme format 1. */
export function upgradeSession<T>(session: T): T;
