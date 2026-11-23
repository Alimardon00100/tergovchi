import { createConnection } from 'node:net';

export function assertSupportedNode(version) {
  const [major, minor] = version.replace(/^v/, '').split('.').map(Number);
  if (!((major === 22 && minor >= 13) || major === 24 || major === 26)) {
    throw new Error('Node.js 22.13+ (22.x), 24.x yoki 26.x kerak.');
  }
}

function parseTarget(raw, name, protocols, defaultPort) {
  let url;
  try {
    url = new URL(raw ?? '');
  } catch {
    throw new Error(`${name}: .env dagi ulanish manzili noto‘g‘ri yoki kiritilmagan.`);
  }
  if (!protocols.includes(url.protocol) || !url.hostname) {
    throw new Error(`${name}: ulanish protokoli yoki host noto‘g‘ri.`);
  }
  if (/CHANGE_ME/i.test(url.password)) {
    throw new Error(`${name}: .env dagi CHANGE_ME o‘rniga xizmatning haqiqiy parolini kiriting.`);
  }
  if (name === 'PostgreSQL' && (url.pathname === '' || url.pathname === '/')) {
    throw new Error('PostgreSQL: ulanish manzilida baza nomini ko‘rsating.');
  }
  return {
    name,
    host: url.hostname.replace(/^\[|\]$/g, ''),
    port: Number(url.port || defaultPort),
  };
}

export function getServiceTargets(environment) {
  return [
    parseTarget(environment.DATABASE_URL, 'PostgreSQL', ['postgres:', 'postgresql:'], 5432),
    parseTarget(environment.REDIS_URL, 'Redis', ['redis:', 'rediss:'], 6379),
  ];
}

export function assertReachable(target, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: target.host, port: target.port });
    const fail = () => {
      socket.destroy();
      reject(
        new Error(
          `${target.name} bilan ulanish yo‘q (${target.host}:${target.port}). Xizmatni ishga tushiring va .env ni tekshiring.`,
        ),
      );
    };
    socket.setTimeout(timeoutMs, fail);
    socket.once('error', fail);
    socket.once('connect', () => {
      socket.destroy();
      resolve();
    });
  });
}
