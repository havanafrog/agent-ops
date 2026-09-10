---
name: board-ui
description: 로컬에서 도는 판(대시보드)을 만들 때. 작은 Node 프로세스가 JSON 을 내고 한 장짜리 HTML 이 몇 초마다 받아 그리는 꼴 — 세션 현황판, 빌드 상태판, 로그 요약판 같은 것. "판 만들어줘", "대시보드", "상태 화면", "localhost 에서 보는 화면" 에 걸린다. 빌드 도구도 프레임워크도 안 쓴다.
---

# 판 만들기

작은 Node 프로세스 하나가 `/api/board` 로 JSON 을 내고, 한 장짜리 HTML 이 몇 초마다
받아서 다시 그린다. `package.json` 도 빌드도 없다. 파일 둘이 전부다.

```
board.mjs     기록을 읽어 JSON 을 만든다. 서버도 여기 있다.
board.html    그 JSON 을 그린다. <style> 과 <script> 를 안에 둔다.
```

**밖으로 열지 마세요.** 판은 대개 남한테 보이면 안 되는 것을 읽는다.
`srv.listen(PORT, '127.0.0.1')` 로 못 박고, 포트 매핑도 `127.0.0.1:8730:8730` 으로 건다.

## 이 순서로 만든다

1. **먼저 데이터를 정한다.** 화면부터 그리면 없는 값을 쓰게 된다. `board()` 가
   내는 객체를 먼저 확정하고 `--selftest` 로 그 모양을 잠근다.
2. **HTML 한 장을 쓴다.** 색은 `:root` 토큰으로, 갱신은 `setInterval(tick, 2000)`.
3. **실제로 띄워서 눈으로 본다.** 스크린샷을 찍어라. 카드가 세로로 터지거나 이름이
   칸을 뚫고 나가는 건 코드를 읽어서는 안 보인다.

## 반드시 밟는 함정들

여기 있는 건 전부 실제로 밟고 시간을 버린 것들이다.

### 1. 페이지는 상수가 아니라 함수로 낸다

```js
const PAGE = readFileSync(join(HERE, 'board.html'), 'utf8');   // 안 된다
const PAGE = () => readFileSync(join(HERE, 'board.html'), 'utf8');   // 이렇게
```

모듈이 올라올 때 한 번 읽으면 파일을 고쳐도 서버가 옛 바이트를 계속 낸다.
"고쳤는데 화면이 그대로"의 90%가 이거다. 통(도커)에 마운트로 걸었으면 더 심하다 —
마운트한 파일만 바뀌면 `compose up -d --build` 가 통을 다시 안 만든다. `restart` 해야 한다.

의심되면 재 보라. 추측하지 말고:

```
curl -s localhost:8730/ | wc -c    # 서버가 주는 크기
wc -c board.html                    # 디스크 크기
```

### 2. 갱신이 사람이 읽어야 할 말을 덮는다

2초마다 다시 그리면 방금 뜬 오류 메시지가 2초 만에 사라진다. 사람은 그걸 못 읽는다.
실제로 "도우미가 죽었습니다"를 이것 때문에 며칠 못 봤다.

```js
let held = 0;
function say(t) { $('tally').textContent = t; held = Date.now() + 6000; }
// 그리는 쪽에서
if (Date.now() >= held) { $('tally').innerHTML = 평소값; }
```

### 3. flex 안에서 줄임표가 안 먹는다

`text-overflow: ellipsis` 는 `min-width: 0` 이 없으면 flex 자식에서 무시된다.
긴 이름이 카드를 뚫고 나간다.

```css
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
```

### 4. 긴 글 하나가 카드를 터뜨린다

명령어 한 줄이 수백 자면 카드만 세로로 늘어나서 격자가 망가진다. **양쪽에서** 자른다 —
서버에서 120자로 자르고(그만큼 안 보내면 되니까), 화면에서 다시 폭에 맞춰 자른다.
격자에는 `align-items: start` 를 줘서 한 칸이 커도 옆이 안 늘어나게 한다.

```css
.cards { display: grid; align-items: start;
         grid-template-columns: repeat(auto-fill, minmax(min(440px, 100%), 1fr)); }
.line { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

`minmax()` 안의 `min(440px, 100%)` 이 폰에서 가로 스크롤을 막는다.

### 5. 값이 속성 안에 들어가면 따옴표도 막는다

```js
const esc = s => String(s ?? '').replace(/[<>&"]/g,
  c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
```

`data-name="${esc(x.name)}"` 에 큰따옴표가 든 이름이 오면 속성이 깨진다.
`<>&` 만 막는 흔한 `esc` 로는 모자란다.

### 6. 탭은 남겨야 한다

2초마다 다시 그리는데 고른 탭을 안 남기면 갱신마다 첫 탭으로 튄다.
`localStorage` 는 사생활 창에서 **던진다** — 읽기도 쓰기도 `try/catch` 로 감싼다.

```js
try { localStorage.setItem('ui.tab', id); } catch { /* 없어도 굴러간다 */ }
```

### 7. 큰 기록은 이어 읽는다

로그가 수십 MB 인데 2초마다 통째로 읽으면 못 쓴다. 뒤에만 붙는(append-only) 파일이면
어디까지 읽었는지 바이트 위치를 기억하고 그 뒤만 읽는다.

**마지막 줄바꿈까지만 센다.** 쓰는 중인 반쪽 줄을 파싱하면 깨지고, 줄바꿈에서 자르면
조각이 항상 온전한 UTF-8 이라 한글도 안 깨진다.

```js
const cut = buf.lastIndexOf(0x0a);
if (cut >= 0) { add(sum, buf.subarray(0, cut).toString('utf8').split('\n')); at += cut + 1; }
```

파일이 줄었으면 갈아엎힌 것이므로 처음부터 다시 센다.
**점검에서 반드시 확인할 것:** 이어 읽은 값이 통째로 읽은 값과 같은가.

### 8. 꼬리만 읽으면 사람 말이 밀려난다

`tail` 로 512KB 만 읽는 건 좋은데, 도구 결과 한 줄(스크린샷 base64 같은)이 그 512KB 를
통째로 먹으면 사람이 친 말이 창 밖으로 밀려나 "시킨 말 없음"이 뜬다.
그런 값은 꼬리 훑기 말고 **따로 적어 두는 쪽**에서 가져와라.

### 9. 없는 짝은 지어내지 않는다

장부 줄에 세션 아이디가 없으면 세션 카드에 붙이지 마라. 그럴듯하게 붙이면 화면이
거짓말을 한다. 붙일 근거가 없으면 **따로 세운다** — 탭을 하나 더 파는 게 낫다.

### 10. 색은 세 상태를 다 적는다

토큰을 맨 `:root` 에 밝은 값으로 깔고, 어두운 값은 미디어 쿼리에서 덮는다.
`body` 배경을 반드시 칠한다 — 안 칠하면 바탕이 비쳐서 글씨가 안 보인다.

```css
:root { --page:#f4f5f8; --text:#191f28; --hair:#e5e8eb; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --page:#17171c; --text:#e9ecef; --hair:#2b2d36; }
}
body { background: var(--page); color: var(--text); }
```

숫자에는 `font-variant-numeric: tabular-nums` 를 준다. 안 주면 갱신할 때마다 자릿수가
흔들려서 눈이 아프다.

## 마무리 점검

- [ ] `127.0.0.1` 에만 걸었나
- [ ] 페이지를 함수로 내는가 (상수 아님)
- [ ] 서버 없을 때 화면이 남는가 (몇 번 실패한 뒤에 말하기)
- [ ] 폭 400px 에서 가로 스크롤이 없는가
- [ ] 밝은 화면 · 어두운 화면 둘 다 봤나
- [ ] 긴 이름 · 긴 명령이 든 카드를 실제로 봤나
- [ ] 데이터 모양을 `--selftest` 로 잠갔나
- [ ] **스크린샷을 찍어서 눈으로 봤나**

마지막 줄이 제일 중요하다. 코드를 읽어서는 카드가 터진 걸 못 본다.
