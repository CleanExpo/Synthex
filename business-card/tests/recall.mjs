import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const source = fs.readFileSync('card.html', 'utf8');
const hosted = fs.readFileSync('site/index.html', 'utf8');
const kit = JSON.parse(
  hosted.match(/<script id="brand-kit">window.BRAND_KIT = (.*?);<\/script>/)[1]
);
const slice = (start, end) =>
  source.slice(
    source.indexOf(start),
    source.indexOf(end, source.indexOf(start))
  );
const safeUrl = value => /^https:\/\/[^\s"<>]+$/.test(value || '');
const code = slice('function meetingMemory(', 'function contactText()');
const context = vm.createContext({ P: kit.person, safeUrl, TextEncoder });
vm.runInContext(code, context);
const card = met => vm.runInContext(`vcard(${JSON.stringify(met)})`, context);
const unfold = text => text.replace(/\r\n[ \t]/g, '');
const empty = card('');
assert.equal(empty, fs.readFileSync('site/phill-mcgurk.vcf', 'utf8'));
assert.equal(empty, fs.readFileSync('phill-mcgurk.vcf', 'utf8'));
const names = [
  'CARSI',
  'RestoreAssist',
  'Disaster Recovery',
  'NRPG',
  'Synthex',
  'TradeHall',
  'Unite-Group Nexus',
];
const plain = unfold(empty);
assert.ok(plain.includes('ORG:Unite-Group\r\n'));
assert.ok(plain.includes('TITLE:Senior Project Manager\r\n'));
assert.ok(
  plain.includes(
    'NICKNAME:Living Card,Marketing,AI,Restoration,Disaster Recovery,Training,Business card guy,CARSI,RestoreAssist,NRPG,Synthex,TradeHall\r\n'
  )
);
assert.ok(
  !/IICRC|47496|BFRS|GBAC/.test(plain),
  'no certifications on the contact'
);
assert.ok(
  plain.includes(
    'NOTE:Search me by: CARSI\\, RestoreAssist\\, Disaster Recovery\\, NRPG\\, Synthex\\, TradeHall\\, Living Card\\, marketing\\, restoration\r\n'
  )
);
const met = card('Brisbane expo');
assert.ok(unfold(met).includes(',TradeHall,Brisbane expo\r\n'));
assert.ok(unfold(met).includes('NOTE:Met: Brisbane expo\\nSearch me by:'));
const hostile = card(
  "  Dave's BBQ, Brisbane; hall \\ west\r\nX-EVIL: injected\nsecond  "
);
assert.ok(
  unfold(hostile).includes(
    "Dave's BBQ\\, Brisbane\\; hall \\\\ west  X-EVIL: injected second"
  )
);
assert.ok(!unfold(hostile).includes('\r\nX-EVIL:'));
assert.equal(card(' \r\n '), empty);
for (const text of [
  empty,
  met,
  hostile,
  card('Caf\u00e9 ' + '\u{1f600}'.repeat(50)),
]) {
  assert.equal(text.replaceAll('\r\n', '').includes('\n'), false);
  assert.ok(text.endsWith('END:VCARD\r\n'));
  for (const line of text.split('\r\n'))
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, line);
  assert.equal(text.includes('\ufffd'), false);
}
assert.ok(hosted.includes('window.CARD_HOSTED = true;'));
assert.ok(hosted.includes('</head>\n<body>'));
assert.ok(source.indexOf('id="met"') < source.indexOf('id="save"'));
assert.ok(!/id="met"[^>]*(required|name=)/.test(source));
const tiles = kit.person.links.filter(
  l => (l.visitor && safeUrl(l.url)) || (!l.url && l.pendingUrl)
);
assert.deepEqual(
  names.filter(name => !tiles.some(l => l.label === name)),
  []
);
// Execute the actual tile renderer and assert the names are appended as visible text.
class El {
  constructor() {
    this.children = [];
    this.hidden = true;
    this.value = '';
    this.handlers = {};
  }
  append(...children) {
    this.children.push(...children);
  }
  appendChild(child) {
    this.children.push(child);
  }
  addEventListener(name, fn) {
    this.handlers[name] = fn;
  }
  setAttribute() {}
  remove() {}
}
const grid = new El(),
  nexus = new El();
vm.runInNewContext(
  slice('  const shelf = links.filter(', '  const f = P.features'),
  {
    links: kit.person.links,
    safeUrl,
    HOSTED: true,
    $: id => (id === 'nexus-grid' ? grid : nexus),
    document: { createElement: () => new El() },
  }
);
assert.equal(nexus.hidden, false);
for (const name of names)
  assert.ok(
    grid.children.some(tile =>
      tile.children.some(
        child => child.className === 'tname' && child.textContent === name
      )
    ),
    name
  );
console.log(
  'PASS both vCards, all seven rendered tile names, recall fields, punctuation, injection prevention, CRLF and UTF-8 folding'
);

// Exercise the real Save handler: no requests or storage are supplied to this context.
for (const [input, isHosted] of [
  ['', true],
  ['  \r\n ', true],
  ['Brisbane expo', true],
  ['Brisbane expo', false],
]) {
  const els = new Map(),
    blobs = [],
    clicked = [],
    timers = [];
  const $ = id => {
    if (!els.has(id)) els.set(id, new El());
    return els.get(id);
  };
  $('met').value = input;
  let revoked = false;
  const ctx = vm.createContext({
    P: kit.person,
    safeUrl,
    TextEncoder,
    $,
    HOSTED: isHosted,
    KIT: kit,
    navigator: { userAgent: 'Android' },
    GREET: '',
    EVENT: null,
    SFX: { chime() {} },
    confetti() {},
    location: {},
    Blob,
    URL: {
      createObjectURL(blob) {
        blobs.push(blob);
        return 'blob:local-card';
      },
      revokeObjectURL() {
        revoked = true;
      },
    },
    document: {
      createElement() {
        const el = new El();
        el.click = () => clicked.push(el);
        return el;
      },
      body: new El(),
    },
    setTimeout(fn, ms) {
      timers.push({ fn, ms });
    },
  });
  vm.runInContext(
    code +
      '\n' +
      slice('$("save").addEventListener(', '$("copy-vcard").addEventListener('),
    ctx
  );
  $('save').handlers.click();
  if (!input.trim()) {
    assert.equal(ctx.location.href, 'phill-mcgurk.vcf');
    assert.equal(blobs.length, 0);
  } else {
    assert.equal(ctx.location.href, undefined);
    assert.equal(blobs.length, 1);
    assert.equal(await blobs[0].text(), met);
    assert.equal(blobs[0].type, 'text/vcard;charset=utf-8');
    assert.equal(clicked[0].download, 'phill-mcgurk.vcf');
    assert.equal(timers[0].ms, 60000);
    timers[0].fn();
    assert.equal(revoked, true);
    if (!isHosted) assert.equal($('vcard-text').textContent, met);
  }
}
console.log(
  'PASS normal-file and personalised browser downloads, local-only processing and preview fallback'
);

// Build from the actual source with a minimal media-free fixture: originals are missing.
const python = String.raw`
from pathlib import Path
import importlib.util, json, copy
root = Path.cwd()
spec = importlib.util.spec_from_file_location('card_build', root / 'site/build.py')
b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
kit = json.loads((root / 'brand-kits/phill-mcgurk.json').read_text(encoding='utf-8'))
expected = (root / 'site/phill-mcgurk.vcf').read_bytes()
assert b.vcard(kit['person']).encode('utf-8') == expected
fixture = copy.deepcopy(kit)
fixture['brand'] = {}
for link in fixture['person']['links']:
    link.pop('video', None)
folder = root / '.test-tmp/recall-build'
folder.mkdir(parents=True, exist_ok=True)
kitpath = folder / 'kit.json'
kitpath.write_text(json.dumps(fixture), encoding='utf-8')
b.main(str(root / 'card.html'), str(kitpath), str(folder))
assert (folder / 'phill-mcgurk.vcf').read_bytes() == expected
assert 'id="met"' in (folder / 'index.html').read_text(encoding='utf-8')
assert (folder / 'card-template.html').read_bytes() == (root / 'card.html').read_bytes()
print('PASS Python builder parity and rebuild from a media-free fixture')
`;
const result = spawnSync('python', ['-I', '-c', python], {
  encoding: 'utf8',
  cwd: process.cwd(),
});
assert.equal(result.status, 0, result.stderr + result.stdout);
console.log(result.stdout.trim());
fs.mkdirSync('.test-tmp/recall', { recursive: true });
fs.writeFileSync('.test-tmp/recall/empty.vcf', empty);
fs.writeFileSync('.test-tmp/recall/brisbane-expo.vcf', met);
console.log(
  'All recall checks passed. Real-device contact import and search still require phone testing.'
);
