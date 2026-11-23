import { fileURLToPath } from 'node:url';
import { stopManagedServices } from './managed-services.mjs';
import { stopWebServer } from './web-runtime.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
stopWebServer(projectRoot)
  .then(() => stopManagedServices(projectRoot))
  .catch(() => {
    process.stderr.write(
      'Mahalliy xizmatlarni to‘xtatib bo‘lmadi. .local ichidagi loglarni tekshiring.\n',
    );
    process.exitCode = 1;
  });
