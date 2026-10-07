const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function starterProductHtml(orderId=''){
  const order=esc(orderId);
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Первый рабочий день инженера — Инженер с нуля</title>
<style>
:root{--ink:#111820;--mut:#5d6874;--line:#dbe2e9;--acc:#ffb000;--teal:#0b8275;--nav:#142d49}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:var(--ink);background:#f6f8fa;line-height:1.55}
.w{width:min(900px,calc(100% - 28px));margin:auto}.hero{background:var(--nav);color:#fff;padding:48px 0}.hero h1{font-size:clamp(36px,6vw,58px);line-height:1;margin:.2em 0}
.hero p{color:#d9e4ef;max-width:760px}.tag{display:inline-block;background:var(--acc);color:#17130a;border-radius:999px;padding:7px 11px;font-weight:800}
main{padding:28px 0 60px}.card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px;margin:16px 0}
h2{font-size:28px;margin:0 0 10px}h3{margin-top:22px}.mut{color:var(--mut)}.ok{font-weight:800;color:var(--teal)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.task{background:#f8fafb;border:1px solid var(--line);border-radius:15px;padding:16px}
code{background:#eef2f5;padding:2px 6px;border-radius:6px}.check{list-style:none;padding:0}.check li{margin:8px 0}.check li:before{content:"☐ ";font-weight:900}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid var(--line);padding:9px;text-align:left;vertical-align:top}
.note{background:#fff6d8;border:1px solid #ead18a;border-radius:14px;padding:14px}.cta{background:var(--nav);color:#fff;border-radius:20px;padding:20px}.cta a{color:#fff}
@media(max-width:700px){.grid{grid-template-columns:1fr}}@media print{body{background:#fff}.hero{padding:24px 0}.card{break-inside:avoid}}
</style>
</head>
<body>
<section class="hero"><div class="w">
<span class="tag">Практикум · 490 ₽</span>
<h1>Первый рабочий день инженера</h1>
<p>Короткий практический маршрут по двум инструментам: AutoCAD для чертежей и исполнительной документации и Primavera P6 для календарного планирования. Цель — не «изучить программы», а за один рабочий подход получить два проверяемых результата.</p>
<p class="mut" style="color:#b9c9d7">Заказ: ${order}</p>
</div></section>
<main><div class="w">

<div class="card">
<h2>Как проходить</h2>
<p>Заложите 2–3 часа. Не читайте всё подряд: выполняйте шаг, сохраняйте результат, только потом переходите дальше. Если одной из программ у вас нет, выполните доступную часть и используйте второй блок как чек-лист на будущее.</p>
<ul class="check">
<li>Создайте отдельную папку <b>ИНЖЕНЕР_ДЕНЬ_1</b>.</li>
<li>Внутри сделайте папки <b>AUTOCAD</b>, <b>PRIMAVERA</b>, <b>СКРИНЫ</b>.</li>
<li>Сохраняйте промежуточные файлы, не перезаписывая исходник.</li>
<li>В конце оставьте два доказательства результата: скрин AutoCAD и скрин Primavera.</li>
</ul>
</div>

<div class="card">
<h2>Блок 1. AutoCAD — проверить чертёж, а не просто открыть его</h2>
<p class="mut">Результат блока: вы умеете найти объект, измерить его, проверить координату/слой и поставить контрольный размер.</p>
<div class="grid">
<div class="task"><b>Навигация</b><p><code>_ZOOM</code> — масштабирование, <code>_PAN</code> — перемещение по чертежу.</p></div>
<div class="task"><b>Проверка</b><p><code>_DIST</code> — расстояние, <code>_ID</code> — координаты точки, <code>_AREA</code> — площадь.</p></div>
<div class="task"><b>Слои</b><p><code>_LAYER</code> — проверьте, не выключен и не заморожен ли нужный слой.</p></div>
<div class="task"><b>Оформление</b><p><code>_DIM</code> — поставьте контрольный размер и проверьте его слой.</p></div>
</div>
<h3>Практика — 35–50 минут</h3>
<ol>
<li>Откройте учебный или любой безопасный рабочий DWG/DXF-копию.</li>
<li>Выберите два характерных угла одного объекта.</li>
<li>Измерьте расстояние <code>_DIST</code> и запишите значение.</li>
<li>Получите координату одной точки через <code>_ID</code>.</li>
<li>Откройте слои через <code>_LAYER</code>; найдите слой объекта и слой размеров.</li>
<li>Поставьте контрольный размер <code>_DIM</code>.</li>
<li>Сохраните копию как <b>DAY1_AUTOCAD_RESULT.dwg</b> и сделайте скрин.</li>
</ol>
<div class="note"><b>Стоп-сигнал:</b> если размер выглядит в 10/100/1000 раз больше ожидаемого, не «масштабируйте на глаз». Сначала проверьте единицы и известный контрольный размер.</div>
</div>

<div class="card">
<h2>Блок 2. Primavera P6 — создать нормальный каркас графика</h2>
<p class="mut">Результат блока: вы понимаете, где Project, WBS и Activity, закрепили Data Date и создали три последовательные работы.</p>
<h3>Пять понятий без лишней теории</h3>
<table>
<tr><th>Понятие</th><th>Что означает</th></tr>
<tr><td>Project</td><td>Контейнер календарного графика.</td></tr>
<tr><td>WBS</td><td>Иерархия частей результата проекта, а не список работ.</td></tr>
<tr><td>Activity</td><td>Конкретная работа или веха.</td></tr>
<tr><td>Data Date</td><td>Граница между фактом и прогнозом.</td></tr>
<tr><td>FS</td><td>Finish-to-Start: следующая работа стартует после окончания предыдущей.</td></tr>
</table>
<h3>Практика — 45–60 минут</h3>
<ol>
<li>Создайте отдельный учебный проект. Не используйте действующий производственный график.</li>
<li>Проверьте формат дат и единицы времени в User Preferences.</li>
<li>Создайте WBS: <b>Подготовка → Выполнение → Сдача</b>.</li>
<li>Создайте по одной Activity в каждом блоке.</li>
<li>Задайте длительности 2, 5 и 1 день.</li>
<li>Свяжите работы последовательно типом FS.</li>
<li>Установите Data Date на дату старта учебного проекта.</li>
<li>Выведите колонки Activity ID, Name, Original Duration, Start, Finish, Total Float.</li>
<li>Сделайте скрин результата.</li>
</ol>
<div class="note"><b>Проверка:</b> увеличьте длительность средней работы. Если дата окончания проекта не меняется, проверьте связи, календарь и ограничения.</div>
</div>

<div class="card">
<h2>Блок 3. Связать чертёж и график мышлением инженера</h2>
<p>На реальном проекте AutoCAD отвечает на вопрос «что и где фактически находится», а Primavera — «когда и в какой логике это должно происходить». Сведите результаты первого дня в одну таблицу:</p>
<table>
<tr><th>Что проверили</th><th>Инструмент</th><th>Доказательство</th><th>Что делать дальше</th></tr>
<tr><td>Геометрия/размер</td><td>AutoCAD</td><td>DWG + скрин</td><td>Слои, проект/факт, координаты</td></tr>
<tr><td>Логика трёх работ</td><td>Primavera P6</td><td>Проект + скрин</td><td>Календари, WBS, связи, baseline</td></tr>
</table>
</div>

<div class="card">
<h2>Контрольный чек-лист</h2>
<ul class="check">
<li>Я умею измерить расстояние в AutoCAD без «рисования поверх».</li>
<li>Я знаю, на каком слое находится объект и размер.</li>
<li>Я понимаю разницу между WBS и Activity.</li>
<li>Я создал три работы и связал их FS.</li>
<li>Я понимаю, зачем нужна Data Date.</li>
<li>У меня есть два файла/скрина-доказательства.</li>
</ul>
<p class="ok">Если отмечены 5–6 пунктов — первый рабочий день пройден.</p>
</div>

<div class="card">
<h2>10 типичных ошибок новичка</h2>
<ol>
<li>Редактировать единственный исходный DWG вместо копии.</li>
<li>Путать масштаб вида и реальные размеры геометрии.</li>
<li>Удалять «пропавший» объект, не проверив слои.</li>
<li>Ставить размеры до проверки единиц.</li>
<li>Собирать P6-график без WBS.</li>
<li>Создавать работы без связей и считать это расписанием.</li>
<li>Использовать ограничения вместо нормальной логики.</li>
<li>Не фиксировать Data Date перед обновлением факта.</li>
<li>Переходить к ресурсам до проверки логики сроков.</li>
<li>Не сохранять доказательство выполненного упражнения.</li>
</ol>
</div>

<div class="cta">
<h2>Следующий шаг</h2>
<p>Если сильнее нужна работа с чертежами — продолжайте полный 21-дневный курс AutoCAD. Если сроки и графики — 14-дневный курс Primavera P6. Если по работе нужны оба навыка, выгоднее комплект.</p>
<p><b>AutoCAD — 1 990 ₽ · Primavera P6 — 2 490 ₽ · комплект — 3 490 ₽.</b></p>
<p>Сайт: <a href="https://inzhener-s-nulya.vercel.app/#courses">inzhener-s-nulya.vercel.app</a></p>
</div>

<p class="mut">Материал предназначен для самостоятельного обучения. Он не является программой повышения квалификации, не заменяет обязательную проектную/рабочую/исполнительную документацию и не включает лицензии AutoCAD или Primavera P6.</p>
</div></main>
</body></html>`;
}

