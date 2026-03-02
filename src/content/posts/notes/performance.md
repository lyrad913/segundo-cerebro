---
title: 빠른 블로그를 위한 기본 원칙
description: 클라이언트 JS 최소화와 정적 인덱싱 기반 검색
date: 2026-02-21
category: notes
tags:
  - performance
  - pagefind
  - web
draft: false
---

초기 로딩 성능을 위해 다음 원칙을 적용합니다.ㅁㄴㅇㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹㄹ

## 원칙

1. 기본은 서버 렌더링 HTML
2. 필수 기능만 최소한의 클라이언트 JS 사용
3. 빌드 타임 인덱싱 검색(Pagefind)

## 체크리스트

- 테마 토글 상태 저장
- 검색 인덱스 정적 생성
- 불필요한 ==번들== 로드 방지

[[getting-started]]
![[getting-started]]

0123456789

### 코드


```cpp
class Solution {
 public:
  int countBinarySubstrings(string s) {
    vector<int> numOfConsequcutive;

    auto prev = s[0];
    int cnt = 0;
    for (auto ch : s) {
      if (prev == ch)
        cnt++;
      else {
        numOfConsequcutive.emplace_back(cnt);
        cnt = 1;
        prev = ch;
      }
    }
    numOfConsequcutive.emplace_back(cnt);

    int ret = 0;
    for (int i = 0; i < numOfConsequcutive.size() - 1; ++i) {
      ret += min(numOfConsequcutive[i], numOfConsequcutive[i + 1]);
    }

    return ret;
  }
};
```
```python
print("Hello World")
```

#### Quote Test

> "최적의 성능을 위해 클라이언트 JS는 필요한 기능에만 최소한으로 사용하세요."
> Performance Best Practices, 2026

#### Callout Test

> [!NOTE]-  
> 기본 검색은 Pagefind로 빌드 타임에 인덱싱됩니다.

> [!TIP]+
> `npm run build` 후 `npm run preview`로 검색 기능을 테스트할 수 있습니다.

> [!WARNING] 경고
> 클라이언트 JS 번들 크기가 50KB를 넘지 않도록 주의하세요.

