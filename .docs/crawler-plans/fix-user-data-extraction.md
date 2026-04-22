Mục tiêu:
Loại bỏ hoàn toàn việc gán profile giả (round-robin) và thay bằng dữ liệu user thật từ Facebook DOM.

Yêu cầu triển khai theo 2 phase để đảm bảo ổn định:

========================
PHASE 1: FIX COMMENT USER (BẮT BUỘC)
========================

1. Update extractCommentCandidates:

Return structure:
{
name: string
profileUrl: string
commentText: string
fbCommentId?: string
}

2. Parse từ DOM:

- Tìm user link: a[href*="facebook.com"]
- Tìm text: div[dir="auto"]

3. Update buildEntities:

- Map comment → profileFbUid từ profileUrl
- KHÔNG dùng round-robin nữa

========================
PHASE 2: REACTION USER (OPTIONAL - FEATURE FLAG)
========================

1. Implement extractReactionsWithUsers:

- Click vào reactions count
- Wait popup
- Scroll popup (max 3 lần)
- Extract:
  - name
  - profileUrl
  - reactionType

2. Add SAFE GUARD:

- Nếu không mở được popup → return []
- Không throw fatal error

3. Limit:

MAX_REACTIONS = 50

========================
GENERAL RULES
========================

- KHÔNG làm crash job nếu fail 1 phần
- Log structured:
  step: 'extract-comments'
  step: 'extract-reactions'

- Giữ backward compatibility

- Add feature flag:

ENABLE_DEEP_REACTIONS=true

========================
EXPECTED RESULT
========================

- Comment có đúng user thật
- Reaction có thể có user nếu bật deep mode
- Không còn random profile assignment
