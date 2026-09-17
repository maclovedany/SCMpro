-- enum 값 추가 (D-058). 새 값은 같은 트랜잭션에서 쓸 수 없어 사용처(010100)와 파일을 분리한다. 재실행 안전.
alter type app.extra_kind add value if not exists 'urgent';
alter type app.approval_kind add value if not exists 'urgent_order';
