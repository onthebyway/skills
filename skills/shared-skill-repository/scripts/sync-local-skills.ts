#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

interface Args {
  repo?: string;
  sources: string[];
  skills: string[];
  all: boolean;
  installSource?: string;
  commit: boolean;
  push: boolean;
  message: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    sources: [],
    skills: [],
    all: false,
    commit: false,
    push: false,
    message: 'Update shared skills',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (!value) throw new Error(`Missing value for ${arg}`);
      return value;
    };

    if (arg === '--repo') args.repo = next();
    else if (arg === '--source') args.sources.push(next());
    else if (arg === '--skill') args.skills.push(next());
    else if (arg === '--all') args.all = true;
    else if (arg === '--install-source') args.installSource = next();
    else if (arg === '--commit') args.commit = true;
    else if (arg === '--push') args.push = true;
    else if (arg === '--message') args.message = next();
    else if (arg === '--help' || arg === '-h') usage(0);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.repo) throw new Error('Missing required --repo <repo-dir>');
  if (!args.sources.length) throw new Error('Provide at least one --source <local-skills-dir>');
  if (!args.all && !args.skills.length) throw new Error('Provide --all or at least one --skill <name>');
  if (args.push && !args.commit) throw new Error('--push requires --commit');

  return args;
}

function usage(code: number): never {
  const stream = code === 0 ? process.stdout : process.stderr;
  stream.write(`Usage: node sync-local-skills.ts --repo <repo-dir> --source <local-skills-dir> (--all | --skill <name>) [options]\n\nOptions:\n  --repo <dir>             Shared skills repo directory (required)\n  --source <dir>           Directory containing local skill folders; repeatable\n  --skill <name>           Skill folder/name to sync; repeatable\n  --all                    Sync all valid skills from each source\n  --install-source <src>   Regenerate README install commands with this source\n  --commit                 Commit README.md and skills/ changes\n  --push                   Push after committing; requires --commit\n  --message <msg>          Commit message (default: Update shared skills)\n  -h, --help               Show this help\n`);
  process.exit(code);
}

function isSkillDir(dir: string): boolean {
  return existsSync(path.join(dir, 'SKILL.md')) && statSync(dir).isDirectory();
}

function listSkills(source: string, selected: Set<string> | null): string[] {
  if (!existsSync(source)) throw new Error(`Source directory does not exist: ${source}`);
  const entries = readdirSync(source).filter((entry) => {
    const fullPath = path.join(source, entry);
    return isSkillDir(fullPath) && (!selected || selected.has(entry));
  });
  return entries.sort((a, b) => a.localeCompare(b));
}

function run(repo: string, command: string, args: string[]): void {
  const result = spawnSync(command, args, { cwd: repo, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

function runCapture(repo: string, command: string, args: string[]): string {
  const result = spawnSync(command, args, { cwd: repo, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

try {
  const args = parseArgs(process.argv.slice(2));
  const repo = path.resolve(args.repo!);
  const destinationRoot = path.join(repo, 'skills');
  const selected = args.all ? null : new Set(args.skills);

  if (!existsSync(repo)) throw new Error(`Repo directory does not exist: ${repo}`);
  mkdirSync(destinationRoot, { recursive: true });

  const synced = new Set<string>();
  for (const rawSource of args.sources) {
    const source = path.resolve(rawSource);
    for (const skill of listSkills(source, selected)) {
      const from = path.join(source, skill);
      const to = path.join(destinationRoot, skill);
      rmSync(to, { recursive: true, force: true });
      cpSync(from, to, {
        recursive: true,
        filter: (src) => {
          const base = path.basename(src);
          return base !== 'node_modules' && base !== '.git' && base !== '.DS_Store';
        },
      });
      synced.add(skill);
      console.log(`Synced ${skill} -> ${path.relative(process.cwd(), to)}`);
    }
  }

  if (!synced.size) {
    throw new Error('No skills were synced. Check --source and --skill values.');
  }

  if (args.installSource) {
    const scriptPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'generate-readme.ts');
    run(process.cwd(), process.execPath, [scriptPath, '--repo', repo, '--source', args.installSource]);
  }

  if (args.commit) {
    run(repo, 'git', ['add', 'README.md', 'skills/']);
    const status = runCapture(repo, 'git', ['status', '--porcelain']);
    if (!status) {
      console.log('No changes to commit.');
    } else {
      run(repo, 'git', ['commit', '-m', args.message]);
      if (args.push) run(repo, 'git', ['push']);
    }
  }

  console.log(`Done. Synced ${synced.size} skill(s): ${Array.from(synced).sort().join(', ')}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  usage(1);
}
