import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BUBBLE_ENDPOINT, MAUTIC_FORM_ID, PRODUCT_SLUG, createPayload, formatPhone,
  thankYouUrl, sendRegistration, attachBubbleSubmission,
} from '../src/scripts/calculadora-form.js';

const component = readFileSync(new URL('../src/components/ContactPage.astro', import.meta.url), 'utf8');

function fixture({ request, valid = true, sdkValid = true } = {}) {
  const inputs = Object.fromEntries(Object.entries({
    nome_completo1: ' Ana ', sobrenome: ' Souza Lima ', email: ' ana+tri@example.com ', telefone: '(11) 98765-4321',
  }).map(([key, value]) => [`mauticform[${key}]`, { value, readOnly: false }]));
  const button = { disabled: false, innerHTML: 'Liberar Acesso', textContent: '' };
  const error = { textContent: '', setAttribute() {} };
  let submit;
  const form = {
    dataset: {},
    ownerDocument: { baseURI: 'https://captura.example.com/' },
    elements: { namedItem: (name) => inputs[name] },
    getAttribute: () => 'calculadoratri',
    querySelector: (selector) => selector.includes('button') ? button : error,
    reportValidity: () => valid,
    addEventListener: (_event, handler) => { submit = handler; },
  };
  const calls = [];
  const callbacks = {};
  const sdk = { validateForm: (_name, send) => { calls.push(send); return sdkValid; } };
  const requests = [];
  attachBubbleSubmission(form, {
    sdk, callbacks,
    request: async (...args) => {
      requests.push(args);
      return request ? request(...args) : { ok: true, text: async () => '{"status":"success"}' };
    },
  });
  return {
    form, inputs, button, error, calls, callbacks, requests,
    submit: () => submit({ preventDefault() {}, stopImmediatePropagation() {} }),
  };
}

test('Mautic script 23 is embedded in the capture form', () => {
  assert.equal(MAUTIC_FORM_ID, '23');
  assert.match(component, /https:\/\/mautic\.vemmed\.com\.br\/form\/generate\.js\?id=23/);
  assert.match(component, /integrateBubbleForm\(\)/);
});

test('payload sends the five fields to the calculator Bubble endpoint', () => {
  const f = fixture();
  assert.deepEqual(createPayload(f.form), {
    nome: 'Ana', email: 'ana+tri@example.com', celular: '11987654321', produto: 'Calculadora TRI', sobrenome: 'Souza Lima',
  });
});

test('payload reads Mautic fields by their visible labels when technical names differ', () => {
  const values = [
    ['Nome *', 'Ana'], ['Sobrenome *', 'Souza'], ['E-mail *', 'ana@example.com'], ['Celular *', '(11) 98765-4321'],
  ];
  const rows = values.map(([label, value]) => ({
    querySelector: (selector) => selector === '.mauticform-label'
      ? { textContent: label }
      : { value },
  }));
  const form = {
    elements: { namedItem: () => null },
    querySelectorAll: () => rows,
  };

  assert.deepEqual(createPayload(form), {
    nome: 'Ana', email: 'ana@example.com', celular: '11987654321', produto: 'Calculadora TRI', sobrenome: 'Souza',
  });
});

test('phone mask handles fixed and mobile numbers and limits length', () => {
  assert.equal(formatPhone('1133334444'), '(11) 3333-4444');
  assert.equal(formatPhone('119876543211234'), '(11) 98765-4321');
  assert.equal(formatPhone(''), '');
});

test('Bubble succeeds before Mautic submits, then redirects with email and product', async () => {
  let resolve;
  const f = fixture({ request: () => new Promise((done) => { resolve = done; }) });
  const send = f.submit();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0], false);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0][0], BUBBLE_ENDPOINT);
  assert.equal(f.requests[0][1].method, 'POST');
  assert.equal(f.requests[0][1].headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(f.requests[0][1].body), createPayload(f.form));
  resolve({ ok: true, text: async () => '{"status":"success"}' });
  await send;
  assert.deepEqual(f.calls, [false, true]);
  const response = { success: true, redirect: 'https://spp.vemmed.com/obrigado?origem=isca' };
  f.callbacks.calculadoratri.onResponseStart(response);
  const destination = new URL(response.redirect);
  assert.equal(destination.searchParams.get('email'), 'ana+tri@example.com');
  assert.equal(destination.searchParams.get('produto'), PRODUCT_SLUG);
  assert.equal(destination.searchParams.get('origem'), 'isca');
});

test('invalid form or Mautic validation does not send to Bubble', async () => {
  for (const options of [{ valid: false }, { sdkValid: false }]) {
    const f = fixture(options);
    await f.submit();
    assert.equal(f.requests.length, 0);
    assert.ok(!f.calls.includes(true));
  }
});

test('invalid phone does not send to Bubble', async () => {
  const f = fixture();
  f.inputs['mauticform[telefone]'].value = '123';
  await f.submit();
  assert.equal(f.requests.length, 0);
  assert.match(f.error.textContent, /DDD/);
});

test('Bubble HTTP and network failures do not submit Mautic and restore controls', async () => {
  for (const request of [async () => ({ ok: false, status: 404 }), async () => { throw new Error('network'); }]) {
    const f = fixture({ request });
    const originalError = console.error;
    console.error = () => {};
    try {
      await f.submit();
      assert.deepEqual(f.calls, [false]);
      assert.match(f.error.textContent, /Não foi possível/);
      assert.equal(f.button.disabled, false);
      assert.ok(Object.values(f.inputs).every((input) => !input.readOnly));
    } finally { console.error = originalError; }
  }
});

test('Mautic redirect is not changed if Bubble was not confirmed or no target exists', async () => {
  const f = fixture();
  const beforeDelivery = { success: true, redirect: 'https://spp.vemmed.com/obrigado' };
  f.callbacks.calculadoratri.onResponseStart(beforeDelivery);
  assert.equal(beforeDelivery.redirect, 'https://spp.vemmed.com/obrigado');
  await f.submit();
  const noRedirect = { success: true };
  f.callbacks.calculadoratri.onResponseStart(noRedirect);
  assert.equal(noRedirect.redirect, undefined);
});

test('Mautic failure does not change its original redirect', async () => {
  const f = fixture();
  await f.submit();
  const response = { success: false, redirect: 'https://spp.vemmed.com/obrigado' };
  f.callbacks.calculadoratri.onResponseStart(response);
  assert.equal(response.redirect, 'https://spp.vemmed.com/obrigado');
});
