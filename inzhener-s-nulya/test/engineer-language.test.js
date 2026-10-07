import test from 'node:test';
import assert from 'node:assert/strict';
import { bilingualText,bilingualHtml } from '../api/_engineer-language.js';
import { starterProductHtml } from '../api/_starter-product.js';
import { engineerSupportAnswer } from '../api/_engineer-support.js';
test('commands and menu labels bilingual; existing pairs and links retained',()=>{
 assert.equal(bilingualText('_DIST _ID _LAYER'), '_DIST / ДИСТ _ID / КООРД _LAYER / СЛОЙ');
 assert.equal(bilingualText('_DIST / ДИСТ'), '_DIST / ДИСТ');
 const link='https://example.com/Project?Name=Activity&ID=123';assert.equal(bilingualText(link),link);
 assert.equal(bilingualText('Project.html'), 'Project.html');
 assert.match(bilingualText('Activities → WBS → Data Date'), /Activities \/ Операции \(работы\).*WBS \/ Структура работ.*Data Date \/ Дата расчёта/);
});
test('HTML scripts, URLs and CSS unchanged; instructions translated',()=>{
 assert.equal(bilingualHtml('<a href="/Project">Activities</a><script>const Name="Project";</script>'),'<a href="/Project">Activities / Операции (работы)</a><script>const Name="Project";</script>');
 const html=starterProductHtml('test-order');for(const word of ['_DIST / ДИСТ','_PAN / ПАН','_ZOOM / ПОКАЗАТЬ','_ID / КООРД','_AREA / ПЛОЩАДЬ','_LAYER / СЛОЙ','_DIM / РАЗМЕР'])assert.ok(html.includes(word),word);
 assert.ok(html.includes('Косую черту'));assert.ok(html.includes('test-order'));
});
test('Russian native command questions yield bilingual replies',()=>{
 assert.match(engineerSupportAnswer('дист').answer,/DIST \/ ДИСТ/);
 assert.match(engineerSupportAnswer('что такое структура работ').answer,/WBS \/ Структура работ/);
});
