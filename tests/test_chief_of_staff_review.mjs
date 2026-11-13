import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../chief_of_staff/review.html", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]+)<\/script>/)[1];
let exported;
let copied;
class Element {
  constructor(tag = "") {
    this.tag = tag;
    this.handlers = {};
    this.children = [];
    this.value = "";
    this.error = null;
  }
  addEventListener(name, fn) { this.handlers[name] = fn; }
  replaceChildren(...children) { this.children = children; }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this[name] = value; }
  focus() {}
  select() {}
  remove() {}
  load() {}
  click() { return this.handlers.click?.({}); }
}
const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, new Element(id)]));
const el = id => elements.get(id);
const context = vm.createContext({
  document: { getElementById: el, createElement: tag => new Element(tag), body: new Element("body") },
  URL: { createObjectURL(value) { if (value instanceof Blob) exported = value; return "blob:fixture"; },
         revokeObjectURL() {} },
  Blob, confirm: () => true, setTimeout: () => 0,
  navigator: { clipboard: { async writeText(text) { copied = text; } } },
  window: new Element("window"),
});
vm.runInContext(script, context);

const media = { name: "fixture.mp4", size: 2500 };
el("video-file").files = [media];
await el("video-file").handlers.change();
assert.equal(el("add").disabled, true);
Object.assign(el("video"), { duration: 3, currentTime: 1.25 });
await el("video").handlers.loadedmetadata();
assert.equal(el("status").textContent, "Video ready.");
assert.equal(el("add").disabled, false);
el("note").value = "Shorten this. <script>as text</script>";
await el("note-form").handlers.submit({ preventDefault() {} });
assert.equal(el("notes").children.length, 1);
const [jump, note, remove] = el("notes").children[0].children;
assert.equal(note.textContent, "Shorten this. <script>as text</script>");
el("video").currentTime = 0;
jump.click();
assert.equal(el("video").currentTime, 1.25);
await el("copy").click();
assert.match(copied, /00:00:01\.250/);
el("export").click();
const saved = JSON.parse(await exported.text());
assert.deepEqual(saved.notes, [{ seconds: 1.25, text: "Shorten this. <script>as text</script>" }]);
assert.equal(saved.asset.name, media.name);

remove.click();
assert.equal(el("notes").children.length, 0);
async function importNotes(value) {
  el("notes-file").files = [{ size: 100, text: async () => JSON.stringify(value) }];
  return el("notes-file").handlers.change();
}
await importNotes(saved);
assert.equal(el("status").textContent, "Imported 1 note(s).");
await importNotes({ ...saved, asset: { ...saved.asset, name: "wrong.mp4" } });
assert.match(el("status").textContent, /different video/);
assert.equal(el("notes").children.length, 1);
await importNotes({ ...saved, notes: [{ seconds: 4, text: "Outside the cut" }] });
assert.match(el("status").textContent, /invalid entries/);
assert.match(html, /connect-src 'none'/);
console.log("Video review script passed simulated DOM add, seek, copy, export, import and invalid-file checks.");
