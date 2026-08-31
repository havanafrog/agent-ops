// 어느 저장소에서 일하고 있나.
//
// 이것 하나 때문에 파일이 따로 있다. 플러그인은 캐시 폴더에 산다 —
// ~/.claude/plugins/cache/... 밑이다. 그래서 스크립트 옆(`import.meta.url`)에
// 장부를 두면 **저장소 열 개가 장부 하나를 같이 쓴다.** 다른 일의 주장이 서로
// 섞이면 판정이 아무 뜻도 없어진다. 장부는 일하는 저장소 안에 있어야 한다.
//
// 훅으로 돌 때는 Claude 가 CLAUDE_PROJECT_DIR 을 준다. 손으로 부를 때는 그
// 저장소 안에서 부르므로 cwd 가 맞다.
import { join } from 'node:path';

export const WORK = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// 장부와 넘김 표시가 사는 곳. 통(도커)에 걸 때는 OPS_DIR 로 바꿔 준다.
export const STATE = process.env.OPS_DIR || join(WORK, '.ops');
