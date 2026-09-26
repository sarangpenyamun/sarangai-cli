import chalk from 'chalk';

const violetDark = chalk.hex('#7c3aed');
const violetBorder = chalk.hex('#5b21b6');
const violetLight = chalk.hex('#a78bfa');

// ASCII Art SarangAI 3D/Shadow sesuai acuan visual
export const SARANGAI_ASCII = `
███████╗ █████╗ ██████╗  █████╗ ███╗   ██╗ ██████╗  █████╗ ██╗
██╔════╝██╔══██╗██╔══██╗██╔══██╗████╗  ██║██╔════╝ ██╔══██╗██║
███████╗███████║██████╔╝███████║██╔██╗ ██║██║  ███╗███████║██║
╚════██║██╔══██║██╔══██╗██╔══██║██║╚██╗██║██║   ██║██╔══██║██║
███████║██║  ██║██║  ██║██║  ██║██║ ╚████║╚██████╔╝██║  ██║██║
╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝
`.trim();

export interface UserStats {
  balance: number;
  tier: string;
  accountId: string;
}

export function formatAccountLine(stats?: UserStats | null): string {
  if (!stats) {
    return `${violetLight('● Account:')} ${chalk.white('—')}  |  ${violetLight('Tier:')} ${chalk.cyan('—')}  |  ${violetLight('⚡ Balance:')} ${chalk.bold.green('—')}`;
  }
  const formattedBalance = new Intl.NumberFormat('en-US').format(stats.balance);
  return (
    `${violetLight('● Account:')} ${chalk.white(stats.accountId)}  |  ` +
    `${violetLight('Tier:')} ${chalk.cyan(stats.tier)}  |  ` +
    `${violetLight('⚡ Balance:')} ${chalk.bold.green(formattedBalance)}`
  );
}

/**
 * Baris-baris header untuk TUI (alternate screen buffer).
 * Header tidak boleh berubah ukuran — selalu tepat 9 baris:
 * 6 ASCII + separator + akun + separator.
 */
export function bannerLines(stats?: UserStats | null): string[] {
  const lines = SARANGAI_ASCII.split('\n');
  lines.push(violetBorder('━'.repeat(68)));
  lines.push(formatAccountLine(stats));
  lines.push(violetBorder('━'.repeat(68)));
  return lines;
}

/** Render banner penuh (dipakai mode non-TUI / fallback). */
export function printBanner(stats?: UserStats | null): void {
  console.log('\n' + bannerLines(stats).join('\n'));
}
