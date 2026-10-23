import fs from 'node:fs/promises';

const jobs = new Map(), owners = new WeakSet();
let nextId = 0;
function job(sender, id) {
  const value = jobs.get(id);
  if (!value || value.sender !== sender) throw new Error('WAV export is no longer open');
  return value;
}

export async function beginWav(sender, target) {
  const id = ++nextId, temp = target + '.' + id + '.part';
  const handle = await fs.open(temp, 'wx');
  jobs.set(id, { sender, target, temp, handle });
  if (!owners.has(sender)) {
    owners.add(sender);
    sender.once('destroyed', () => { for (const [key, value] of jobs) if (value.sender === sender) abortWav(sender, key).catch(console.error); });
  }
  return id;
}
export async function appendWav(sender, id, bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length > 1048576) throw new Error('Invalid WAV chunk');
  await job(sender, id).handle.writeFile(bytes);
}
export async function finishWav(sender, id) {
  const value = job(sender, id);
  await value.handle.close(); value.handle = null;
  await fs.link(value.temp, value.target);
  await fs.unlink(value.temp);
  jobs.delete(id);
  return value.target;
}
export async function abortWav(sender, id) {
  const value = job(sender, id);
  jobs.delete(id);
  if (value.handle) await value.handle.close();
  await fs.unlink(value.temp);
}
