import test from'node:test';
import assert from'node:assert/strict';
import{engineerSupportAnswer}from'../api/_engineer-support.js';

test('answers AutoCAD measurement question',()=>{
  const r=engineerSupportAnswer('Как измерить расстояние в AutoCAD через DIST?');
  assert.equal(r.category,'autocad_dist');
  assert.match(r.answer,/DIST/);
});

test('answers Primavera WBS question',()=>{
  const r=engineerSupportAnswer('Что такое WBS в Primavera?');
  assert.equal(r.category,'primavera_wbs');
  assert.match(r.answer,/WBS/);
});

test('does not invent unsupported answer',()=>{
  const r=engineerSupportAnswer('Как рассчитать сварной шов по нормам?');
  assert.equal(r.category,'fallback');
  assert.match(r.answer,/не придумывать/i);
});
