import { execFileSync } from 'child_process';
import { writeFileSync as fsWrite } from 'fs';
import os from 'os';
import { join } from 'path';

// Ensures inbound firewall rules exist so phones on the LAN can reach the game.
// Windows only. Checks first (no admin needed); only elevates (one UAC prompt)
// if a rule is actually missing. Set SKIP_FIREWALL=1 to disable.
const ruleName = (port) => `TriviaGame TCP ${port}`;

function ruleExists(port) {
  try {
    const out = execFileSync('netsh', ['advfirewall', 'firewall', 'show', 'rule', `name=${ruleName(port)}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return !/No rules match/i.test(out);
  } catch {
    return false; // netsh exits non-zero when no rule matches
  }
}

function isAdmin() {
  try {
    execFileSync('net', ['session'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function ensureFirewall(ports) {
  if (process.platform !== 'win32') return;
  if (process.env.SKIP_FIREWALL === '1') return;

  const missing = ports.filter((p) => !ruleExists(p));
  if (missing.length === 0) return;

  // build an idempotent add script (delete-then-add avoids duplicates)
  const script = missing
    .map(
      (p) =>
        `Remove-NetFirewallRule -DisplayName "${ruleName(p)}" -ErrorAction SilentlyContinue;` +
        `New-NetFirewallRule -DisplayName "${ruleName(p)}" -Direction Inbound -Action Allow -Protocol TCP -LocalPort ${p} -Profile Private | Out-Null`
    )
    .join('\n');

  const tmp = join(os.tmpdir(), 'trivia-firewall.ps1');
  fsWrite(tmp, script, 'utf8');

  try {
    if (isAdmin()) {
      execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmp], { stdio: 'ignore' });
      console.log(`Firewall: opened TCP ${missing.join(', ')} (Private).`);
    } else {
      console.log(`Firewall: opening TCP ${missing.join(', ')} — accept the Windows prompt…`);
      // elevate a one-shot; -Wait so we know it finished, Hidden so no flash
      execFileSync(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          `Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden ` +
            `-ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${tmp}'`,
        ],
        { stdio: 'ignore' }
      );
      console.log('Firewall: rules added.');
    }
  } catch {
    console.log(
      `Firewall: could not add rules automatically (declined or blocked). ` +
        `If phones can't connect, run "just firewall-open".`
    );
  }
}
