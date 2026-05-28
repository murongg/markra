import type {
  AppSettingsRuntime,
  RuntimeStoreLoadOptions
} from "@markra/app/runtime";
import type { IndexedDbSettingsRuntimeOptions } from "./types";

const defaultIndexedDbDatabaseName = "markra-web-runtime";
const defaultIndexedDbObjectStoreName = "stores";

type IndexedDbSettingsRecord = {
  path: string;
  values: Record<string, unknown>;
};

function resolveIndexedDbFactory(indexedDb?: IDBFactory | null) {
  if (indexedDb) return indexedDb;
  if (typeof globalThis.indexedDB !== "undefined") return globalThis.indexedDB;

  throw new Error("IndexedDB is unavailable in this runtime.");
}

function requestToPromise<TResult>(request: IDBRequest<TResult>) {
  return new Promise<TResult>((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed."));
    };
  });
}

function openIndexedDbStore(databaseName: string, objectStoreName: string, indexedDb: IDBFactory) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDb.open(databaseName, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(objectStoreName)) {
        database.createObjectStore(objectStoreName, { keyPath: "path" });
      }
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB open failed."));
    };
    request.onblocked = () => {
      reject(new Error("IndexedDB open was blocked by another connection."));
    };
  });
}

function normalizeRecordValues(record: IndexedDbSettingsRecord | undefined) {
  if (record && typeof record.values === "object" && record.values !== null) {
    return record.values;
  }

  return {};
}

export function createIndexedDbSettingsRuntime(
  options: IndexedDbSettingsRuntimeOptions = {}
): AppSettingsRuntime {
  const databaseName = options.databaseName ?? defaultIndexedDbDatabaseName;
  const objectStoreName = options.objectStoreName ?? defaultIndexedDbObjectStoreName;
  const indexedDb = resolveIndexedDbFactory(options.indexedDB);
  let databasePromise: Promise<IDBDatabase> | null = null;

  async function getDatabase() {
    databasePromise ??= openIndexedDbStore(databaseName, objectStoreName, indexedDb);

    return databasePromise;
  }

  async function readStore(path: string) {
    const database = await getDatabase();
    const transaction = database.transaction(objectStoreName, "readonly");
    const objectStore = transaction.objectStore(objectStoreName);

    return requestToPromise<IndexedDbSettingsRecord | undefined>(objectStore.get(path));
  }

  async function writeStore(path: string, values: Record<string, unknown>) {
    const database = await getDatabase();
    const transaction = database.transaction(objectStoreName, "readwrite");
    const objectStore = transaction.objectStore(objectStoreName);

    await requestToPromise(objectStore.put({ path, values }));
  }

  return {
    async loadStore(path: string, loadOptions: RuntimeStoreLoadOptions) {
      const record = await readStore(path);
      const values = new Map<string, unknown>([
        ...Object.entries(loadOptions.defaults),
        ...Object.entries(normalizeRecordValues(record))
      ]);

      async function save() {
        await writeStore(path, Object.fromEntries(values));
      }

      return {
        async delete(key) {
          values.delete(key);
          if (loadOptions.autoSave) await save();
        },
        async get<T>(key: string) {
          return values.get(key) as T | undefined;
        },
        save,
        async set(key, value) {
          values.set(key, value);
          if (loadOptions.autoSave) await save();
        }
      };
    }
  };
}
