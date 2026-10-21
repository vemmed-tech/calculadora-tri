import test from 'node:test';
import assert from 'node:assert/strict';
import { BUBBLE_ENDPOINT, PRODUCT_SLUG, THANK_YOU_URL, createPayload, formatPhone, thankYouUrl, sendRegistration, attachCalculatorForm } from '../src/scripts/calculadora-form.js';

function fixture(request = async () => ({ ok: true, text: async () => '{"status":"success"}' })) {
  const elements = Object.fromEntries(Object.entries({ nome:' Ana ', sobrenome:' Souza Lima ', email:' ana+tri@example.com ', celular:'(11) 98765-4321' }).map(([key,value])=>[key,{value,readOnly:false,addEventListener(){}}]));
  const button = { textContent:'Liberar Acesso', disabled:false };
  const error = { textContent:'', focus(){} };
  const navigations = [];
  const requests = [];
  let listener;
  let valid = true;
  const form = {
    elements: {namedItem:(key)=>elements[key]},
    querySelector:(selector)=>selector.includes('button')?button:error,
    addEventListener:(_event,handler)=>{listener=handler;},
    reportValidity:()=>valid,
    setAttribute(){},removeAttribute(){},
  };
  attachCalculatorForm(form, {
    request:async (...args)=>{requests.push(args);return request(...args);},
    navigate:(url)=>navigations.push(url),
  });
  return {form,elements,button,error,navigations,requests,setValid:(value)=>{valid=value;},submit:()=>listener({preventDefault(){}})};
}

test('payload has the five confirmed fields, trims text and sends phone digits',()=>{
  const f=fixture();
  assert.deepEqual(createPayload(f.form), {nome:'Ana',sobrenome:'Souza Lima',email:'ana+tri@example.com',celular:'11987654321',produto:'Calculadora TRI'});
});

test('phone mask handles fixed and mobile numbers and limits length',()=>{
  assert.equal(formatPhone('1133334444'),'(11) 3333-4444');
  assert.equal(formatPhone('119876543211234'),'(11) 98765-4321');
  assert.equal(formatPhone(''), '');
});

test('success POSTs JSON to the provided endpoint and redirects only after confirmation',async()=>{
  let resolve;
  const f=fixture(()=>new Promise(done=>{resolve=done;}));
  const send=f.submit();
  assert.equal(f.navigations.length,0);
  assert.equal(f.button.disabled,true);
  assert.equal(f.requests[0][0],BUBBLE_ENDPOINT);
  assert.equal(f.requests[0][1].method,'POST');
  assert.equal(f.requests[0][1].headers['Content-Type'],'application/json');
  assert.deepEqual(JSON.parse(f.requests[0][1].body),createPayload(f.form));
  resolve({ok:true,text:async()=>'{"status":"success"}'});
  await send;
  assert.deepEqual(f.navigations,[`${THANK_YOU_URL}?email=ana%2Btri%40example.com&produto=calculadora_tri`]);
});

test('invalid fields do not POST',async()=>{
  const f=fixture(); f.setValid(false); await f.submit(); assert.equal(f.requests.length,0);
  f.setValid(true); f.elements.celular.value='123'; await f.submit(); assert.equal(f.requests.length,0);
});

test('HTTP and network failures restore fields, show errors and do not redirect',async()=>{
  for(const request of [async()=>({ok:false,status:401}),async()=>{throw new Error('network');}]) {
    const f=fixture(request); await f.submit();
    assert.equal(f.navigations.length,0); assert.match(f.error.textContent,/Não foi possível/);
    assert.equal(f.button.disabled,false); assert.ok(Object.values(f.elements).every(field=>!field.readOnly));
  }
});

test('Bubble status error is not treated as success',async()=>{
  await assert.rejects(()=>sendRegistration({},async()=>({ok:true,text:async()=>'{"status":"error"}'})));
});

test('double submit does not send twice and failure allows another attempt',async()=>{
  let resolve; const f=fixture(()=>new Promise(done=>{resolve=done;}));
  const first=f.submit(); await f.submit(); assert.equal(f.requests.length,1);
  resolve({ok:false,status:500}); await first;
  const second=f.submit(); assert.equal(f.requests.length,2);
  resolve({ok:true,text:async()=>'{"status":"success"}'}); await second;
});

test('email and product are encoded in the shared thank-you URL',()=>{
  const url=new URL(thankYouUrl('ana+tri@example.com'));
  assert.equal(url.origin,new URL(THANK_YOU_URL).origin);
  assert.equal(url.href.startsWith(THANK_YOU_URL),true);
  assert.equal(url.searchParams.get('email'),'ana+tri@example.com');
  assert.equal(url.searchParams.get('produto'),PRODUCT_SLUG);
});

