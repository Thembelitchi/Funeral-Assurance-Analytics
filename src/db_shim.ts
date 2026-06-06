import alasqlImport from 'alasql';

const alasql = alasqlImport as any;

const strftime = (format: string, dateStr: any): string => {
  if (!dateStr) return '';
  let d: Date;
  if (typeof dateStr === 'string') {
    // Handle standard database date string formats
    d = new Date(dateStr);
  } else if (typeof dateStr === 'number') {
    if (dateStr < 10000000000) {
      d = new Date(dateStr * 1000);
    } else {
      d = new Date(dateStr);
    }
  } else if (dateStr instanceof Date) {
    d = dateStr;
  } else {
    d = new Date(String(dateStr));
  }

  if (isNaN(d.getTime())) {
    return String(dateStr);
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  return format.replace(/%[YmdHMS]/g, (match) => {
    switch (match) {
      case '%Y': return String(d.getFullYear());
      case '%m': return pad(d.getMonth() + 1);
      case '%d': return pad(d.getDate());
      case '%H': return pad(d.getHours());
      case '%M': return pad(d.getMinutes());
      case '%S': return pad(d.getSeconds());
      default: return match;
    }
  });
};

// Register custom SQL scalar functions for AlaSQL
alasql.fn.strftime = strftime;
alasql.fn.STRFTIME = strftime;

const julianday = (dateStr: any): number => {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return (d.getTime() / 86400000) + 2440587.5;
};
alasql.fn.julianday = julianday;
alasql.fn.JULIANDAY = julianday;

export class Database {
  constructor(db_path: string, modeOrCallback?: any, callback?: any) {
    let cb = callback;
    if (typeof modeOrCallback === 'function') {
      cb = modeOrCallback;
    }
    if (cb) {
      setTimeout(() => cb(null), 0);
    }
  }

  serialize(cb: () => void) {
    // AlaSQL executes queries synchronously and instantly, so serialize is synchronous.
    cb();
  }

  run(sql: string, paramsOrCallback?: any, callback?: (err: Error | null) => void) {
    let params: any[] = [];
    let cb = callback;
    if (typeof paramsOrCallback === 'function') {
      cb = paramsOrCallback;
    } else if (paramsOrCallback !== undefined) {
      params = Array.isArray(paramsOrCallback) ? paramsOrCallback : [paramsOrCallback];
    }

    try {
      alasql(sql, params);
      if (cb) cb(null);
    } catch (err: any) {
      console.error("AlaSQL run statement error:", err, "SQL:", sql);
      if (cb) cb(err);
    }
    return this;
  }

  all(sql: string, paramsOrCallback?: any, callback?: (err: Error | null, rows?: any[]) => void) {
    let params: any[] = [];
    let cb = callback;
    if (typeof paramsOrCallback === 'function') {
      cb = paramsOrCallback;
    } else if (paramsOrCallback !== undefined) {
      params = Array.isArray(paramsOrCallback) ? paramsOrCallback : [paramsOrCallback];
    }

    try {
      const rows = alasql(sql, params);
      if (cb) cb(null, rows);
    } catch (err: any) {
      console.error("AlaSQL all query error:", err, "SQL:", sql);
      if (cb) cb(err);
    }
    return this;
  }

  get(sql: string, paramsOrCallback?: any, callback?: (err: Error | null, row?: any) => void) {
    let params: any[] = [];
    let cb = callback;
    if (typeof paramsOrCallback === 'function') {
      cb = paramsOrCallback;
    } else if (paramsOrCallback !== undefined) {
      params = Array.isArray(paramsOrCallback) ? paramsOrCallback : [paramsOrCallback];
    }

    try {
      const rows = alasql(sql, params);
      const row = rows && rows.length > 0 ? rows[0] : null;
      if (cb) cb(null, row);
    } catch (err: any) {
      console.error("AlaSQL get query error:", err, "SQL:", sql);
      if (cb) cb(err);
    }
    return this;
  }

  prepare(sql: string, callback?: (err: Error | null, stmt?: any) => void) {
    try {
      const compiled = alasql.compile(sql);
      const stmtObj = {
        run: (...args: any[]) => {
          let runParams = args;
          let runCb: any = null;
          if (args.length > 0 && typeof args[args.length - 1] === 'function') {
            runCb = args[args.length - 1];
            runParams = args.slice(0, args.length - 1);
          }
          if (runParams.length === 1 && Array.isArray(runParams[0])) {
            runParams = runParams[0];
          }
          try {
            compiled(runParams);
            if (runCb) runCb(null);
          } catch (err: any) {
            console.error("AlaSQL prepared statement execution error:", err, "SQL:", sql);
            if (runCb) runCb(err);
          }
          return stmtObj;
        },
        finalize: (cb?: any) => {
          if (cb) cb();
        }
      };

      if (callback) callback(null, stmtObj);
      return stmtObj;
    } catch (err: any) {
      console.error("AlaSQL compiled statement build error:", err, "SQL:", sql);
      if (callback) {
        callback(err);
        return null;
      }
      throw err;
    }
  }

  close(callback?: (err: Error | null) => void) {
    if (callback) callback(null);
  }
}

export const OPEN_READWRITE = 1;
export const OPEN_CREATE = 2;

const sqlite3Shim = {
  Database,
  OPEN_READWRITE,
  OPEN_CREATE
};

export default sqlite3Shim;
