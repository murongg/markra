import { FakeIndexedDbFactory } from "../../test/web-runtime-fakes";
import { createIndexedDbSettingsRuntime } from "./settings";

describe("IndexedDB settings runtime", () => {
  it("persists settings stores in IndexedDB", async () => {
    const fakeIndexedDb = new FakeIndexedDbFactory();
    const settings = createIndexedDbSettingsRuntime({
      databaseName: "markra-web-test",
      indexedDB: fakeIndexedDb.indexedDB
    });

    const store = await settings.loadStore("settings.json", {
      autoSave: false,
      defaults: { theme: "system" }
    });

    await expect(store.get("theme")).resolves.toBe("system");

    await store.set("theme", "dark");
    const unsavedStore = await settings.loadStore("settings.json", {
      autoSave: false,
      defaults: { theme: "system" }
    });
    await expect(unsavedStore.get("theme")).resolves.toBe("system");

    await store.save();
    const savedStore = await settings.loadStore("settings.json", {
      autoSave: false,
      defaults: { theme: "system" }
    });

    await expect(savedStore.get("theme")).resolves.toBe("dark");
    expect(fakeIndexedDb.openedNames).toEqual(["markra-web-test"]);
  });

  it("supports autosaving settings mutations in IndexedDB", async () => {
    const settings = createIndexedDbSettingsRuntime({
      indexedDB: new FakeIndexedDbFactory().indexedDB
    });
    const store = await settings.loadStore("settings.json", {
      autoSave: true,
      defaults: {}
    });

    await store.set("language", "zh-CN");

    const savedStore = await settings.loadStore("settings.json", {
      autoSave: false,
      defaults: {}
    });
    await expect(savedStore.get("language")).resolves.toBe("zh-CN");

    await store.delete("language");
    const deletedStore = await settings.loadStore("settings.json", {
      autoSave: false,
      defaults: { language: "en" }
    });

    await expect(deletedStore.get("language")).resolves.toBe("en");
  });
});
