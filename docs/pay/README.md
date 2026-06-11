# 支付与会员（pay）

Stripe 嵌入式收银台、会员套餐定价、开通/续期/到期校正，以及个人资料页会员展示。

| 专题 | 说明 |
|------|------|
| [stripe-membership-billing.md](./stripe-membership-billing.md) | **主文档**：Stripe 三档会员充值、后端开通逻辑、资料页与支付页前端 |
| [membership-grant-idempotency.md](./membership-grant-idempotency.md) | Webhook + 完成回调并发防双次加时 |
| [membership-active-hook.md](./membership-active-hook.md) | 前端 `useMembershipActive` Hook、资料页金色会员标识 |
| （规划） | 微信扫码（YunGouOS）见仓库内后端 SPEC `yungouos-wechat-native-membership.md`，尚未落地 |

**常见排查**

| 现象 | 优先阅读 |
|------|----------|
| 支付成功但资料页仍非会员 | [stripe-membership-billing.md](./stripe-membership-billing.md) §6、§9 |
| 会员到期仍显示徽章 | 同上 §7（`memberExpiresAt` 与读时校正） |
| 会员到期日多约一个套餐周期 | [membership-grant-idempotency.md](./membership-grant-idempotency.md) |
