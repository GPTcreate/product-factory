# PDF 한글 글꼴

이 디렉터리의 Factory Korean Regular/Bold는 Google Fonts의 Noto Sans KR을
기반으로 만든 정적 글꼴입니다. SIL Open Font License 1.1에 따라 배포하며 원문은
OFL-NotoSansKR.txt에 보존합니다.

- 원본: https://github.com/google/fonts/tree/main/ofl/notosanskr
- 원본 파일: NotoSansKR[wght].ttf
- 원본 SHA-256: 194018e6b2b293a7964f037b25c0249ce1418bc9ab3c971060a03aa57861e252
- 생성 방식: fontTools로 wght 400/700 정적 인스턴스를 만든 뒤 라틴 문자,
  한글 음절·자모, 문장 부호·기호·가나 문자 범위를 보존했습니다.
- 원본과 구분하기 위해 수정 글꼴의 이름을 Factory Korean으로 변경했습니다.

화면의 초기 로딩에는 사용하지 않으며, PDF를 내보낼 때만 같은 사이트에서
불러옵니다. PDF에는 사용한 글자만 포함합니다.
