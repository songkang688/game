/**
 * 浏览器通道用的目录句柄仓库:把家长选好的存档文件夹句柄记在 IndexedDB 里。
 *
 * 为什么非得 IndexedDB:File System Access 的 FileSystemDirectoryHandle 只能结构化克隆,
 * 塞不进 localStorage(JSON.stringify 会变成空对象)。
 *
 * 铁律:
 *  - 这里存的只是「去哪儿找存档」的门牌号,不存存档内容本身;
 *  - 浏览器被卸载/清数据时门牌号会丢,但文件夹里的存档文件还在,
 *    家长重新选一次同一个文件夹就能接回来(这正是「卸载不丢」的落点);
 *  - 任何一步失败都安静降级,绝不抛异常打断游戏。
 */

const DB_NAME = "yiduo-yixing.vault";
const DB_VERSION = 1;
const STORE = "handles";
const HANDLE_KEY = "backupDir";

interface IDBFactoryLike {
  open(name: string, version?: number): IDBOpenDBRequest;
}

function idb(): IDBFactoryLike | null {
  const factory = (globalThis as { indexedDB?: IDBFactoryLike }).indexedDB;
  return factory ?? null;
}

function openDb(): Promise<IDBDatabase | null> {
  const factory = idb();
  if (!factory) return Promise.resolve(null);
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = factory.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then((db) => {
    if (!db) return null;
    return new Promise<T | null>((resolve) => {
      let req: IDBRequest<T>;
      try {
        req = run(db.transaction(STORE, mode).objectStore(STORE));
      } catch {
        db.close();
        resolve(null);
        return;
      }
      req.onsuccess = () => {
        resolve(req.result ?? null);
        db.close();
      };
      req.onerror = () => {
        resolve(null);
        db.close();
      };
    });
  });
}

/** 记住家长选的存档文件夹 */
export function rememberDirHandle(handle: unknown): Promise<void> {
  return withStore("readwrite", (store) => store.put(handle as never, HANDLE_KEY) as IDBRequest<unknown>).then(
    () => undefined
  );
}

/** 取回上次记住的存档文件夹(没有就是 null) */
export function recallDirHandle(): Promise<unknown | null> {
  return withStore("readonly", (store) => store.get(HANDLE_KEY) as IDBRequest<unknown>);
}

/** 家长点「不再自动备份」时把门牌号忘掉(文件夹里的存档文件不动) */
export function forgetDirHandle(): Promise<void> {
  return withStore("readwrite", (store) => store.delete(HANDLE_KEY) as IDBRequest<unknown>).then(() => undefined);
}
