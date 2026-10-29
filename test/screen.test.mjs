import test from 'node:test';
import assert from 'node:assert/strict';
import { createScreenWakeLock } from '../web/screen.mjs';

const flush = () => new Promise(resolve => setImmediate(resolve));
function sentinel() {
  const lock = new EventTarget(); lock.released = false;
  lock.release = async () => {
    lock.released = true; lock.dispatchEvent(new Event('release'));
  };
  return lock;
}

test('screen lock is requested once and released when play pauses', async () => {
  const pending = Promise.withResolvers(), lock = sentinel(); let calls = 0;
  const screen = createScreenWakeLock({ request(type) { assert.equal(type,'screen'); calls++; return pending.promise; } });
  screen.update(true); screen.update(true); assert.equal(calls,1);
  pending.resolve(lock); await flush(); screen.update(true); assert.equal(calls,1);
  screen.update(false); await flush(); assert.equal(lock.released,true);
});

test('a late screen lock cannot remain held after leaving active play', async () => {
  const pending = Promise.withResolvers(), lock = sentinel();
  const screen = createScreenWakeLock({request:()=>pending.promise});
  screen.update(true); screen.update(false); pending.resolve(lock); await flush();
  assert.equal(lock.released,true);
});

test('returning while an old request is pending acquires a fresh screen lock', async () => {
  const requests=[], oldLock=sentinel(), newLock=sentinel();
  const screen=createScreenWakeLock({request() { const pending=Promise.withResolvers(); requests.push(pending); return pending.promise; }});
  screen.update(true); screen.update(false); screen.update(true);
  assert.equal(requests.length,1);
  requests[0].resolve(oldLock); await flush();
  assert.equal(oldLock.released,true); assert.equal(requests.length,2);
  requests[1].resolve(newLock); await flush(); screen.update(true);
  assert.equal(newLock.released,false); assert.equal(requests.length,2);
  screen.update(false); await flush(); assert.equal(newLock.released,true);
});

test('system release permits a later retry without immediately looping', async () => {
  const locks=[];
  const screen=createScreenWakeLock({async request() { const lock=sentinel(); locks.push(lock); return lock; }});
  screen.update(true); await flush(); await locks[0].release(); await flush();
  assert.equal(locks.length,1);
  screen.update(true); await flush(); assert.equal(locks.length,2);
  screen.update(false); await flush(); assert.equal(locks[1].released,true);
});

test('unavailable or denied screen locks never block play or retry continuously', async () => {
  const unavailable=createScreenWakeLock(null); unavailable.update(true); unavailable.update(false);
  let calls=0;
  const denied=createScreenWakeLock({request() { calls++; return Promise.reject(new Error('Not allowed')); }});
  denied.update(true); await flush(); assert.equal(calls,1);
  denied.update(true); await flush(); assert.equal(calls,2);
  denied.update(false); await flush(); assert.equal(calls,2);
});
