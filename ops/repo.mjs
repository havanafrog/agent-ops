// 지금 이 저장소가 어떤 상태인가. 판 머리에 거는 한 줄이 여기서 나온다.
//
//   node ops/repo.mjs --selftest
//
// git 에서만 읽는다. 아무것도 안 적는다.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { WORK } from './home.mjs';

const git = (...a) => {
  try { return execFileSync('git', a, { cwd: WORK, encoding: 'utf8', timeout: 5000 }).trim(); }
  catch { return null; }              // git 이 없거나 저장소가 아니면 조용히 넘긴다
};

export function repo() {
  // 구분자는 탭이다. 제목에 탭이 들어갈 일은 없지만, 들어가도 뒤가 제목으로 붙게
  // 앞 둘만 떼고 나머지를 다시 잇는다.
  const head = git('log', '-1', '--format=%h%x09%cI%x09%s');
  const [hash, when, ...rest] = (head ?? '').split('\t');
  const subject = rest.join('\t');
  const dirty = (git('status', '--porcelain') ?? '')
    .split('\n').filter(Boolean).map(l => ({ how: l.slice(0, 2).trim(), path: l.slice(3) }));
  // 앞서 있는 커밋. 원격이 없으면 null 이지 0 이 아니다 — 둘은 다른 뜻이다.
  const ahead = git('rev-list', '--count', '@{upstream}..HEAD');
  return {
    branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
    head: hash ? { hash, subject, when } : null,
    dirty,
    ahead: ahead === null ? null : +ahead,
  };
}

export function selftest() {
  let n = 0;
  const ok = (what, cond, extra = '') => {
    n++;
    console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${what}${extra ? '  ' + extra : ''}`);
    if (!cond) process.exitCode = 1;
  };
  const r = repo();
  ok('저장소를 읽는다', r && typeof r === 'object');
  ok('안 올린 파일은 목록', Array.isArray(r.dirty));
  ok('앞선 커밋은 숫자이거나 null', r.ahead === null || Number.isFinite(r.ahead), String(r.ahead));
  // git 이 없는 곳에서도 죽지 않아야 한다 — 판이 통 안에서도 돈다.
  ok('git 이 없어도 안 죽는다', r.branch === null || typeof r.branch === 'string');
  console.log(`\n${n}개 점검 통과\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--selftest')) { console.log('\n자체 점검\n'); selftest(); }
  else console.log(JSON.stringify(repo(), null, 2));
}
