import { writeFile } from 'node:fs/promises';
import { TcmbClient } from 'tcmb-mcp';
import { textDots, textWidth } from './dot-font.mjs';

const CURRENCIES = ['USD', 'EUR', 'GBP'];
const PITCH = 5;
const COLUMNS = 172;
const ROWS = 74;
const FRAME = 18;
const WIDTH = COLUMNS * PITCH + FRAME * 2;
const HEIGHT = ROWS * PITCH + FRAME * 2 + 34;

const colors = {
  housing: '#16181b',
  rim: '#2c3036',
  panel: '#0b0c0e',
  unlit: '#1d2024',
  amber: '#ffab1f',
  red: '#ff4b3a',
  green: '#3ddc84',
  caption: '#8b929b',
};

const BUY_RIGHT = 106;
const SELL_RIGHT = 156;
const LEFT = 8;

function decimal(value) {
  return value === null ? null : Number(value) / 1e12;
}

function rateText(value) {
  return value === null ? '-' : value.toFixed(4);
}

function tcmbDate(date) {
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
}

async function loadRates() {
  const client = new TcmbClient({ timeoutMs: 20_000 });
  const latest = await client.latest();
  const previous = await client.resolveBefore(latest.date).catch(() => null);
  const rows = CURRENCIES.map((code) => {
    const today = latest.currencies.get(code);
    const before = previous?.currencies.get(code);
    const buy = decimal(today?.rates.forex_buying ?? null);
    const sell = decimal(today?.rates.forex_selling ?? null);
    const previousSell = decimal(before?.rates.forex_selling ?? null);
    const trend =
      sell === null || previousSell === null || sell === previousSell
        ? '='
        : sell > previousSell
          ? '▲'
          : '▼';
    return { code, buy: rateText(buy), sell: rateText(sell), trend };
  });
  return { date: latest.date, number: latest.number, rows };
}

function layer(dots, color, glow) {
  const circles = dots
    .map(([x, y]) => `<circle cx="${FRAME + x * PITCH + PITCH / 2}" cy="${FRAME + y * PITCH + PITCH / 2}" r="2"/>`)
    .join('');
  return `<g fill="${color}"${glow ? ' filter="url(#glow)"' : ''}>${circles}</g>`;
}

function render({ date, number, rows }) {
  const amber = [
    ...textDots('EFE ÖZKAN', LEFT, 4),
    ...textDots(tcmbDate(date), SELL_RIGHT + 9 - textWidth(tcmbDate(date)), 4),
    ...textDots('FULL STACK DEVELOPER', LEFT, 14),
    ...textDots('ALIŞ', BUY_RIGHT - textWidth('ALIŞ'), 32),
    ...textDots('SATIŞ', SELL_RIGHT - textWidth('SATIŞ'), 32),
  ];
  const red = [];
  const green = [];

  rows.forEach((row, index) => {
    const y = 44 + index * 10;
    amber.push(...textDots(row.code, LEFT, y));
    red.push(...textDots(row.buy, BUY_RIGHT - textWidth(row.buy), y));
    red.push(...textDots(row.sell, SELL_RIGHT - textWidth(row.sell), y));
    const target = row.trend === '▲' ? green : row.trend === '▼' ? red : amber;
    target.push(...textDots(row.trend, SELL_RIGHT + 4, y));
  });

  const panelWidth = COLUMNS * PITCH;
  const panelHeight = ROWS * PITCH;
  const railY = FRAME + 26 * PITCH;
  const caption = `TCMB indicative rates · bulletin ${number ?? '-'} · ${tcmbDate(date)} 15:30 · drawn by tcmb-mcp`;
  const screws = [
    [9, 9],
    [WIDTH - 9, 9],
    [9, HEIGHT - 9],
    [WIDTH - 9, HEIGHT - 9],
  ]
    .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="3" fill="#24272c" stroke="#3a3f46"/>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="title">
<title id="title">Efe Özkan, full stack developer. TCMB rates for ${tcmbDate(date)}: ${rows.map((row) => `${row.code} ${row.buy} / ${row.sell}`).join(', ')}</title>
<defs>
<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<pattern id="grid" width="${PITCH}" height="${PITCH}" patternUnits="userSpaceOnUse" x="${FRAME}" y="${FRAME}"><circle cx="${PITCH / 2}" cy="${PITCH / 2}" r="2" fill="${colors.unlit}"/></pattern>
</defs>
<rect width="${WIDTH}" height="${HEIGHT}" rx="14" fill="${colors.housing}"/>
<rect x="1" y="1" width="${WIDTH - 2}" height="${HEIGHT - 2}" rx="13" fill="none" stroke="${colors.rim}" stroke-width="2"/>
${screws}
<rect x="${FRAME}" y="${FRAME}" width="${panelWidth}" height="${panelHeight}" rx="4" fill="${colors.panel}"/>
<rect x="${FRAME}" y="${FRAME}" width="${panelWidth}" height="${panelHeight}" fill="url(#grid)"/>
<rect x="${FRAME}" y="${railY}" width="${panelWidth}" height="${PITCH}" fill="${colors.housing}"/>
${layer(amber, colors.amber, true)}
${layer(red, colors.red, true)}
${layer(green, colors.green, true)}
<text x="${FRAME}" y="${HEIGHT - FRAME + 2}" fill="${colors.caption}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="12">${caption}</text>
</svg>
`;
}

try {
  const board = render(await loadRates());
  await writeFile('board.svg', board);
  console.log('board.svg updated');
} catch (error) {
  console.error(`Kept the previous board: ${error.message}`);
}
