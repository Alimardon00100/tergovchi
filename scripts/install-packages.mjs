import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
// Windows may briefly retain an old junction immediately after a package update.
// Retry that observed condition once; unrelated install failures still stop startup.
export async function installPackages(projectRoot, pnpmCli, environment) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = spawnSync(process.execPath, [pnpmCli, 'install', '--frozen-lockfile'], {
      cwd: projectRoot,
      env: environment,
      stdio: 'pipe',
      encoding: 'utf8',
      shell: false,
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (!result.error && result.status === 0) return;
    if (
      attempt === 0 &&
      /EPERM[\s\S]*symlink/i.test((result.stdout ?? '') + (result.stderr ?? ''))
    ) {
      process.stdout.write(
        'Windows paket havolasini bo‘shatishi kutilmoqda. Bir marta qayta uriniladi...\n',
      );
      await delay(750);
      continue;
    }
    throw new Error('Kutubxonalar o‘rnatilmadi. Yuqoridagi xatoni tekshiring.');
  }
}
