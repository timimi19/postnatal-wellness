# App Requirements: 산후 웰니스 (Postnatal Wellness)

## Overview
산후우울증을 겪는 아내와 그 남편을 함께 지원하는 모바일 웰니스 앱. 남편은 산후우울증에 대한 교육을 받고 아내의 감정 상태를 파악할 수 있으며, 아내는 자신의 감정을 기록하고 맞춤형 지원을 받을 수 있다.

## Problem Statement
남편이 산후우울증을 잘 몰라서 아내를 제대로 돕지 못한다. 이 앱은 남편에게 필요한 정보와 행동 가이드를 제공하고, 아내의 상태를 실시간으로 파악할 수 있게 함으로써 커플이 함께 산후 회복을 헤쳐나갈 수 있도록 돕는다.

## Target Users
- **아내**: 출산 후 감정 상태를 기록하고 지원을 받는 주 사용자
- **남편**: 아내의 상태를 파악하고 행동 가이드를 받는 파트너 사용자

## Core Features (MVP)
1. **Onboarding Flow** — 역할 선택 → 동의 → 자가진단(PHQ-9/EPDS) → 니즈 설문 → 디바이스 페어링 → 맞춤 플랜 생성
2. **Mood Logging Flow** — 음성/텍스트 입력 → Sentiment Analysis → 우울감 수준·이유 판단 → 아내/남편 각각 행동 추천
3. **Partner Reminder Flow** — GPS 기반 귀가 감지 → 팝업 및 음성인식 활성화 유도

## Out of Scope
- 전문 의료 진단
- 약 처방
- 보험 연동

## Technical Constraints
- 모바일 환경 (iOS / Android)
- HealthKit 동기화 (Biometric 기능 포함 시)
- 커플 디바이스 페어링 필요

## Non-Functional Requirements
- **Security:** 로그인 필수, 민감 건강 데이터 보호
- **Performance:** 실시간 GPS 감지 및 감정 분석 응답 속도 중요
- **Accessibility:** 산후 피로 상태의 사용자를 고려한 간단한 UX

## Future Features (Post-MVP)
- **Biometric Tracking** — HealthKit 동기화 → 웰니스 점수 → 대시보드 + 이상 징후 알림
- **Hospital Integration** — threshold 초과 시 동의 기반 데이터 공유 → 임상의 대시보드 → 후속 케어

## Success Criteria
- 앱 사용 후 산모의 정신적 건강 지표(PHQ-9/EPDS 점수) 개선
- 남편의 지원 행동 빈도 증가
- 커플의 지속적인 앱 사용률
