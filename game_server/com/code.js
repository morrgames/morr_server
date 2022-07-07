'use strict';

const code = {};

//game packet code
code.game_packet = {};

code.game_packet.reg_id = 101; // 계정생성
code.game_packet.login = 103; // 로그인

code.game_packet._test_packet = 99999; // 테스트용 패킷

//error code
code.error = {};
code.error.none = 200; // 성공 코드

code.error.critical_data_valid = -100; // 데이타 오류
code.error.wrong_packet = -101; // 잘못된 패킷오류
code.error.nohandler = -102; // 없는 프로토콜
code.error.unknown = -103; // 알수없는 에러 : 예외처리 하지 않은 모든오류 - 서버 담당자에게 문의
code.error.validator = -104; // request 파라메터가 잘못되었다. : validator 에서 걸러진 경우
code.error.crypto = -108; // 암호화 복호화 과정 오류
code.error.nodata = -109; // 빈데이타 보냄
code.error.session_invalid = -110; // redis 세션 데이타가 존재하지 않는다.
code.error.session = -111; // client 에서 보내준 세션값이 잘못되었다. : 다른유저가 같은 계정으로 중복로그인일 확률이큼
code.error.parameter = -112; // validator 를 통과 했지만 이후에서 체크한 파라메터에서 오류가 났을때
code.error.logical = -113; // 참조 테이블 데이타 등의 로직적인 오류

code.error.server_login_block = -200; // 서버 로그인이 잠겨있습니다.
code.error.version = -201; // 로그인 버전이 틀립니다. : 다운로드 페이지로 이동해주세요
code.error.server_inspect = -202; // 서버 점검중 입니다.
code.error.server_regid_block = -204; // 서버에 계정생성이 잠겨 있습니다.

code.error.not_found_id = -1023; // 계정정보를 찾을수 없습니다.
code.error.regid_overlap_id = -1024; // 계정 생성시 아이디 중복
code.error.regid_overlap_name = -1025; // 계정 생성시 네임 중복
code.error.overlap_link_id = -1026; // 이미 연동된 sns id

code.error.block_user = -1030; // 블럭된 유저입니다.

module.exports = code;
