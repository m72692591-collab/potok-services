import test from'node:test';
import assert from'node:assert/strict';
import{normalChoice}from'../api/_funnel-content.js';

test('normalChoice maps funnel choices',()=>{
  assert.equal(normalChoice('autocad'),'autocad');
  assert.equal(normalChoice('P6'),'primavera');
  assert.equal(normalChoice('Primavera'),'primavera');
  assert.equal(normalChoice('оба'),'both');
  assert.equal(normalChoice('unknown'),'');
});
