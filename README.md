# mafest-web

금융상품 질의 검색 데모의 웹이다. 질문을 받아 `mafest-api`의 `/v1`을 부르고, 답변·해석한 조건·상품 표·"어떻게 답했나"를 보여 준다.
로그인이 없는 공개 웹이며 DB·모델 서버에 직접 접속하지 않는다. 설계 근거는 mafest `docs/plans/37_공개웹_최종계획.md` §2·§3·§5다.

이 레포에는 데이터가 없다. mock 픽스처(`src/lib/fixtures.ts`)는 전부 **합성 값**(SAMPLE·DEMO 상품, 지어낸 수치·건수·테이블 이름)이다. 실제 응답을 복사해 넣지 않는다.

## 화면

| 주소                     | 화면                                                                    |
| ------------------------ | ----------------------------------------------------------------------- |
| `/`                      | 검색창, 예시 질문 칩(`/v1/meta`), 상품군별 건수·기준일                  |
| `/search?q=`             | 답변, 해석한 조건, 상품 표(넓은 화면)·카드(좁은 화면), 어떻게 답했나    |
| `/search?q=&p=도메인/id` | 넓은 화면에서 결과 오른쪽 패널에 상품 상세                              |
| `/products/:domain/:id`  | 상품 상세(좁은 화면 또는 직접 링크). 값별 출처·기준일, 관계 → 관련 검색 |
| `/about`                 | 동작 방식, 데이터 범위, 한계, 기록 정책, 비공식 고지                    |

- 상태는 URL에만 있다. 새로고침·뒤로가기·링크 공유가 그대로 된다.
- outcome 8종(`answered` `caveat` `no_result` `not_collected` `unavailable` `ambiguous` `refused` `error`)과 `generated_by=fallback`(모델 꺼짐 배너), HTTP 429(Retry-After 카운트다운)·504·5xx·연결 실패를 각각 다른 화면으로 그린다.
- 숫자는 오른쪽 정렬·고정폭. 수익률은 색 없이 부호로만.
- 기준일은 상품군마다 다르다. 같으면 하나로, 다르면 상품군별로 나열한다.
- 상품 상세에 "이전/다음 상품"이나 상품군 전체 목록은 두지 않는다(대량 수집 억제).
- `robots.txt` `Disallow: /`, `<meta name="robots" content="noindex">`, nginx `X-Robots-Tag`로 색인을 막는다.

## 로컬 실행

Node 22.23.1 기준.

```sh
nvm use
npm ci
VITE_API_MODE=mock npm run dev
```

mock 모드는 질문 낱말로 픽스처를 고른다(`src/lib/mockApi.ts`).

| 질문에 들어간 말         | 화면                |
| ------------------------ | ------------------- |
| (그 밖)                  | answered            |
| 퇴직연금, ETN            | caveat              |
| 0.01%, 50%               | no_result           |
| 거래량, 호가, 시세       | not_collected       |
| 편입, 구성종목           | unavailable         |
| 좋은, 괜찮은             | ambiguous           |
| 추천, 오를, 전망         | refused             |
| 오류                     | error               |
| 모델                     | answered + fallback |
| 몇 개 / 채권·AA·표면금리 | 개수 / 채권 결과    |
| 429 / 504 / 500          | HTTP 실패           |

실제 API를 붙일 때는 로컬 API 주소를 준다(브라우저에는 전송되지 않는다).

```sh
VITE_API_MODE=real VITE_LOCAL_API_TARGET=http://127.0.0.1:18080 npm run dev
```

실제 API 오류를 mock 응답으로 바꾸지 않는다. 운영 번들(`VITE_API_MODE=real`)에는 mock 모듈과 픽스처가 들어가지 않는다(`src/lib/client.ts`, `container:verify`가 검사).

## 검증

```sh
npm run lint
npm run format:check
npm run typecheck
npm test               # 화면·계약·api 테스트. 실연동은 [미실행]으로 표시된다
npm run build
npm run test:scripts   # 이미지 금지 경로 검사의 회귀 테스트
npm run container:verify   # Docker 필요. linux/amd64 이미지를 빌드해 검사
```

테스트 3층:

| 층        | 파일                                              | 보는 것                                                         |
| --------- | ------------------------------------------------- | --------------------------------------------------------------- |
| 화면      | `src/App.test.tsx`                                | 합성 API로 화면 로직(outcome 8종, 상세, 429, URL)               |
| API 계약  | `src/lib/validate.test.ts`, `src/lib/api.test.ts` | 픽스처가 계약을 지키는지, 요청 형태와 실패 처리                 |
| 실제 HTTP | `src/lib/api.live.test.ts`                        | `MAFEST_LIVE_API=<주소>`일 때만. 예시 칩 6개의 기대 outcome(W6) |

## API 계약

`src/lib/types.ts`(타입)와 `src/lib/validate.ts`(받는 즉시 검사)가 37 §3의 계약이다. 응답이 계약과 다르면 성공처럼 그리지 않고 "응답 형식 오류"로 보인다.

37에서 정하지 않아 웹이 정한 것(P7에서 서버와 맞춘다):

- **`suggestions: [{label, question}]`** (최상위, 선택). no_result의 완화 질문, refused의 "대신 할 수 있는 질문"(B3), not_collected의 대안 질문. 없으면 빈 배열로 본다.
- `results[].rows[].values`의 키는 그 묶음의 `columns[].key` 안에 있어야 한다.
- 상품 상세 필드에 `kind`(열 종류)를 둔다. 숫자 정렬에 쓴다.
- `relations[].items[]`는 `{id, name, display, question}`. `question`이 없으면 이름으로 검색한다.
- `outcome: "error"`를 200으로 주든 500으로 주든 웹은 같은 화면을 그린다(본문이 계약을 지키면).
- 429는 `Retry-After`(초)를 읽는다.

## 배포

- 이미지: 비루트 nginx(8080), read-only rootfs + `/tmp` tmpfs, `/healthz`(no-store).
- `/v1`은 이 컨테이너가 아니라 Traefik이 `mafest-api`로 보낸다(같은 origin, CORS 없음). 여기서는 404.
- 앱 라우트(`/search`, `/about`, `/products/<d>/<id>`)만 index.html로 되돌린다. 라우트를 추가하면 `nginx/default.conf`와 `scripts/verify-container.sh`를 함께 고친다.
- 사이트 이름에 특정 금융회사 이름·로고·색을 쓰지 않는다. 문구는 `src/lib/site.ts` 한곳에 있다.

## 남은 일

- W6: P7(공개 API) 뒤 실 API 연결, `api.live.test.ts`로 예시 칩 6개 실측.
- 단계 스트리밍(SSE)은 v1.1 선택 항목이다.
