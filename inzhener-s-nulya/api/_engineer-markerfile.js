import { TextDecoder } from 'node:util';

// Независимый пилот. Не сохраняет исходные файлы и не делает правовых выводов.
export const MAX_MARKERFILE_BYTES = 1024 * 1024;
export const MAX_MARKERFILE_ROWS = 3000;
const LENGTHS = new Set([8, 12, 13, 14]);
const COMMANDS = new Set(['/marker', '/gtin', '🧾 проверить gtin', '🧾 проверить таблицу']);

export function gs1CheckDigit(body) {
  if (!/^\d+$/.test(body)) return null;
  let sum = 0;
  for (let i = body.length - 1, k = 3; i >= 0; i--, k = k === 3 ? 1 : 3) sum += Number(body[i]) * k;
  return (10 - sum % 10) % 10;
}

export function verifyGtin(code) {
  if (!/^\d+$/.test(code)) return 'В коде есть нецифровые символы';
  if (!LENGTHS.has(code.length)) return 'Недопустимая длина GTIN';
  if (Number(code.at(-1)) !== gs1CheckDigit(code.slice(0, -1))) return 'Неверная контрольная цифра GS1';
  return '';
}

function decodeCsv(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(data).replace(/^\uFEFF/, ''); }
  catch { return new TextDecoder('windows-1251').decode(data).replace(/^\uFEFF/, ''); }
}

function detectSeparator(header) {
  let best = ';', count = -1;
  for (const sep of [';', ',', '\t']) {
    let n = 0, quoted = false;
    for (let i = 0; i < header.length; i++) {
      if (header[i] === '"') quoted = !quoted;
      else if (!quoted && header[i] === sep) n++;
    }
    if (n > count) { count = n; best = sep; }
  }
  return best;
}

export function parseCsv(text, separator = null) {
  if (typeof text !== 'string') throw new Error('Требуется текст CSV');
  if (text.length > MAX_MARKERFILE_BYTES * 2) throw new Error('Слишком большой CSV');
  const first = text.split(/\r?\n/, 1)[0];
  const sep = separator || detectSeparator(first);
  const rows = []; let row = [], value = '', quoted = false, afterQuote = false;
  function pushRow() {
    row.push(value);
    rows.push(row);
    if (rows.length > MAX_MARKERFILE_ROWS + 2) throw new Error('Для бесплатной проверки допускается не более 3000 строк');
    row = []; value = ''; afterQuote = false;
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { value += '"'; i++; }
        else { quoted = false; afterQuote = true; }
      } else value += ch;
    } else if (ch === sep) { row.push(value); value = ''; afterQuote = false; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; pushRow(); }
    else if (ch === '"' && value === '' && !afterQuote) quoted = true;
    else { value += ch; afterQuote = false; }
  }
  if (quoted) throw new Error('Незакрытые кавычки в CSV');
  if (value !== '' || row.length) pushRow();
  return rows;
}

export function analyzeCsv(bytes) {
  const raw = decodeCsv(bytes);
  const rows = parseCsv(raw);
  if (rows.length < 2) throw new Error('Нужны заголовок и хотя бы одна строка данных');
  const headers = rows[0].map(v => v.trim().toLowerCase().replace(/ё/g, 'е'));
  let col = headers.findIndex(h => /^(gtin|ean|ean-?13|ean-?14|штрих.?код|штрихкод|код товара)$/.test(h));
  if (col < 0) throw new Error('Не найдена колонка GTIN. Назовите её GTIN или Штрихкод');
  let valid = 0, invalid = 0, blanks = 0;
  const seen = new Map(), issues = [], warnings = [];
  const addIssue = (row, msg) => { invalid++; if (issues.length < 18) issues.push('Стр. ' + row + ': ' + msg); };
  let end = rows.length;
  while (end > 1 && rows[end - 1].every(v => !v.trim())) end--;
  for (let i = 1; i < end; i++) {
    const row = rows[i], num = i + 1;
    if (row.every(v => !v.trim())) { blanks++; addIssue(num, 'полностью пустая строка'); continue; }
    const original = row[col] || '', code = original.trim();
    if (!code) { addIssue(num, 'GTIN не заполнен'); continue; }
    if (original !== code && warnings.length < 8) warnings.push('Стр. ' + num + ': пробелы по краям GTIN');
    const error = verifyGtin(code);
    if (error) { addIssue(num, error); continue; }
    const key = code.padStart(14, '0');
    if (seen.has(key)) { addIssue(num, 'повтор GTIN (стр. ' + seen.get(key) + ')'); continue; }
    seen.set(key, num); valid++;
    if (code[0] === '0' && warnings.length < 8) warnings.push('Стр. ' + num + ': сохраните ведущие нули при экспорте из Excel');
  }
  return { total: valid + invalid, valid, invalid, blanks, issues, warnings, header: rows[0][col] };
}

export function markerfileIntro() {
  return '🧾 МаркерФайл — бесплатная проверка товарных кодов.\n\nОтправьте в этот чат CSV-файл (до 1 МБ, до 3000 строк). Заголовок нужной колонки: GTIN или Штрихкод.\n\nПроверю длину и контрольную цифру GS1, дубликаты, пропуски и пустые строки. Отчёт верну сообщением.\n\nXLSX пока не поддерживается — сохраните таблицу как CSV. Не отправляйте персональные данные или секретные сведения. Файл не сохраняется нашим сервисом, но проходит через инфраструктуру MAX.\n\nЭто независимая техническая проверка, не подтверждение регистрации в «Честном знаке».';
}

export async function engineerMarkerfileReply(update, { download } = {}) {
  if (update?.update_type !== 'message_created') return null;
  const m = update.message, id = Number(m?.sender?.user_id);
  if (!Number.isSafeInteger(id) || id <= 0 || m?.sender?.is_bot === true || m?.recipient?.chat_type !== 'dialog') return null;
  const input = String(m?.body?.text || '').trim().toLowerCase().replace(/ё/g, 'е');
  if (COMMANDS.has(input)) return { userId: id, text: markerfileIntro(), attachments: [] };
  const attachments = Array.isArray(m?.body?.attachments) ? m.body.attachments : [];
  const f = attachments.find(a => a?.type === 'file' && /\.(csv|txt)$/i.test(String(a.filename || '')));
  if (!f) {
    const unsupported = attachments.find(a => a?.type === 'file' && /\.(xlsx|xls)$/i.test(String(a.filename || '')));
    return unsupported ? { userId: id, text: 'Пока принимаю только CSV. Откройте XLSX в Excel или другом редакторе и сохраните как CSV UTF-8, затем отправьте сюда.', attachments: [] } : null;
  }
  const n = Number(f.size);
  if (!Number.isFinite(n) || n < 0 || n > MAX_MARKERFILE_BYTES) return { userId: id, text: 'Файл слишком большой или размер не определён. Нужен CSV до 1 МБ.', attachments: [] };
  const url = f?.payload?.url;
  if (typeof url !== 'string' || !url) return { userId: id, text: 'MAX не передал ссылку на файл. Попробуйте отправить CSV ещё раз.', attachments: [] };
  if (typeof download !== 'function') throw new Error('markerfile_downloader_missing');
  try {
    const bytes = await download(url, MAX_MARKERFILE_BYTES);
    const r = analyzeCsv(bytes);
    const lines = ['🧾 МаркерФайл — результат технической проверки', '', 'Проверено строк: ' + r.total, '✅ Без ошибок: ' + r.valid, '❌ С ошибками: ' + r.invalid, 'Пустых строк: ' + r.blanks];
    if (r.issues.length) lines.push('', 'Замечания (до 18):', ...r.issues);
    if (r.warnings.length) lines.push('', 'Предупреждения:', ...r.warnings);
    lines.push('', 'Отчёт предварительный. Проверьте GTIN и применимость требований в официальном Национальном каталоге. Таблица на нашем сервере не сохраняется.');
    return { userId: id, text: lines.join('\n').slice(0, 3500), attachments: [] };
  } catch (err) {
    const reason = String(err?.message || '').slice(0, 100);
    return { userId: id, text: 'Не получилось безопасно разобрать CSV. ' + (reason === 'markerfile_invalid_download_url' ? 'MAX передал неподдерживаемый адрес вложения.' : reason || 'Попробуйте сохранить CSV в UTF-8.'), attachments: [] };
  }
}
