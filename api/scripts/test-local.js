/**
 * Testleri yerel, tek kullanimlik bir Postgres uzerinde calistirir.
 *
 *   npm run test:local              (tum testler)
 *   npm run test:local -- questions (yalnizca eslesen dosyalar)
 *
 * Neden bu betik var: testler tablolari TRUNCATE ediyor, bu yuzden
 * tests/helpers.js TEST_DATABASE_URL olmadan calismayi reddediyor (dogru
 * davranis: .env uretim veritabanina bakiyor). Burada Docker'da ayri bir
 * veritabani ayaga kaldirip migration'lari uyguluyor ve testleri ona
 * yonlendiriyoruz; uretim veritabanina hic dokunulmuyor.
 *
 * Konteyner testlerden sonra ayakta kalir (sonraki calistirma hizli olsun
 * diye). Silmek icin:  docker rm -f kardiyo-test-db
 */
const { spawnSync } = require('child_process');
const path = require('path');

const API_DIR = path.join(__dirname, '..');

/** Senkron bekleme; betik bastan sona sirali aktigi icin async'e gerek yok. */
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const CONTAINER = 'kardiyo-test-db';
const IMAGE = 'postgres:16-alpine';
const PORT = 55432;
const DB = 'kardiyo_test';
const URL = `postgresql://postgres:test@127.0.0.1:${PORT}/${DB}`;

// .env DATABASE_SSL=true diyor; yerel konteynerde SSL yok, ezilmezse baglanti duser.
const ENV = { ...process.env, TEST_DATABASE_URL: URL, DATABASE_URL: URL, DATABASE_SSL: 'false' };

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { shell: true, encoding: 'utf8', ...opts });

/**
 * Node'u kabuk uzerinden CAGIRMA: Windows'ta calistirilabilir yol bosluk
 * icerdiginde ("C:\Program Files\nodejs\node.exe") kabuk onu ikiye boluyor.
 */
const runNode = (args, opts = {}) =>
  spawnSync(process.execPath, args, { shell: false, encoding: 'utf8', ...opts });

const die = (msg) => {
  console.error(`\n${msg}\n`);
  process.exit(1);
};

function ensureDockerRunning() {
  const r = run('docker', ['version', '--format', '{{.Server.Version}}']);
  if (r.status !== 0) {
    die(
      'Docker motoru calismiyor. Docker Desktop\'i acip yeniden deneyin.\n' +
        '(Kurulum varsayilan yerde degilse: %LOCALAPPDATA%\\Programs\\DockerDesktop\\Docker Desktop.exe)'
    );
  }
  console.log(`Docker hazir (sunucu ${r.stdout.trim()}).`);
}

/** Konteyner yoksa olusturur, durmussa baslatir. */
function ensureContainer() {
  const existing = run('docker', ['ps', '-aq', '--filter', `name=^${CONTAINER}$`]).stdout.trim();
  if (!existing) {
    console.log(`Test veritabani olusturuluyor (${IMAGE}, port ${PORT})...`);
    const r = run('docker', [
      'run', '-d', '--name', CONTAINER,
      '-e', 'POSTGRES_PASSWORD=test',
      '-e', `POSTGRES_DB=${DB}`,
      '-p', `${PORT}:5432`,
      IMAGE,
    ], { stdio: 'inherit' });
    if (r.status !== 0) die('Test veritabani konteyneri baslatilamadi.');
  } else {
    const running = run('docker', ['ps', '-q', '--filter', `name=^${CONTAINER}$`]).stdout.trim();
    if (!running) {
      console.log('Mevcut test veritabani konteyneri baslatiliyor...');
      run('docker', ['start', CONTAINER], { stdio: 'inherit' });
    } else {
      console.log('Test veritabani konteyneri zaten calisiyor.');
    }
  }
}

/** Postgres baglanti kabul edene kadar bekler (ilk kurulumda birkac saniye surer). */
function waitForPostgres() {
  for (let i = 0; i < 30; i += 1) {
    const r = run('docker', ['exec', CONTAINER, 'pg_isready', '-U', 'postgres', '-d', DB]);
    if (r.status === 0) {
      console.log('Postgres hazir.');
      return;
    }
    sleep(2000);
  }
  die('Postgres 60 saniyede hazir olmadi.');
}

function migrate() {
  console.log('Migration\'lar uygulaniyor...');
  const r = runNode([path.join(API_DIR, 'scripts', 'migrate.js')], {
    stdio: 'inherit',
    env: ENV,
    cwd: API_DIR,
  });
  if (r.status !== 0) die('Migration basarisiz.');
}

function test(args) {
  console.log('Testler calistiriliyor...\n');
  // npx yerine jest'in kendi giris dosyasi: kabuk gerekmiyor, PATH'e bagli degil
  const jest = path.join(API_DIR, 'node_modules', 'jest', 'bin', 'jest.js');
  const r = runNode([jest, '--runInBand', '--forceExit', ...args], {
    stdio: 'inherit',
    env: ENV,
    cwd: API_DIR,
  });
  return r.status ?? 1;
}

ensureDockerRunning();
ensureContainer();
waitForPostgres();
migrate();
const code = test(process.argv.slice(2));
console.log(
  code === 0
    ? `\nTamam. Konteyner ayakta birakildi; silmek icin: docker rm -f ${CONTAINER}`
    : `\nTestler basarisiz. Konteyner ayakta: docker rm -f ${CONTAINER}`
);
process.exit(code);
