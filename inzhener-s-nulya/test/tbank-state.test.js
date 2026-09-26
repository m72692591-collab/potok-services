import assert from 'node:assert/strict';
import { test } from 'node:test';
import { safeTbankState } from '../api/_tbank.js';

process.env.TBANK_TERMINAL_KEY = 'terminal-1';
const product = { price: 1990 };
const valid = {
  Success: true,
  ErrorCode: '0',
  TerminalKey: 'terminal-1',
  OrderId: 'order-1',
  PaymentId: 'payment-1',
  Amount: 199000,
  Status: 'CONFIRMED'
};

test('accepts only the exact authoritative confirmed payment', () => {
  assert.equal(safeTbankState(valid, product, 'order-1', 'payment-1').state, 'paid');
  for (const patch of [
    { Success: false },
    { ErrorCode: '1' },
    { TerminalKey: 'other' },
    { OrderId: 'other' },
    { PaymentId: 'other' },
    { Amount: 249000 }
  ]) {
    assert.notEqual(safeTbankState({ ...valid, ...patch }, product, 'order-1', 'payment-1').state, 'paid');
  }
});
