# 合成资料字典

`fixtures/records.json` 是记录数组。`id` 全局唯一，`kind` 是类型，`links` 指向本资料集内的记录。身份按稳定ID判断，不能以名称替代。日期采用ISO 8601；带时区的时间按实际时刻比较。输入可继续新增，样例数量不是产品容量。

## 业务含义

- `scope`：地域与用途均为枚举；日期区间左闭右开，只有三维范围重合才构成独占冲突。
- `mandate`：每个权利人独立委托，不假设主办方能代表其他份额。
- `shares`：尾分按份额精确值的小数余数降序分配，同余按权利人ID排序。
- `usage`：同一企业、月份、地域对应申报修订，原记录是演练输入，不是已结算账。

## 记录与字段

- `owner`：示例ID为 `owner-a`；业务字段 `share`。
- `licensee`：示例ID为 `buyer-a`；业务字段 。
- `patent`：示例ID为 `patent-a`；业务字段 `territories`, `uses`, `validFrom`, `validUntil`。
- `mandate`：示例ID为 `mandate-a`；业务字段 `territories`, `uses`。
- `license-request`：示例ID为 `request-a`；业务字段 `territories`, `use`, `startsAt`, `until`, `exclusive`。
- `commercial-terms`：示例ID为 `terms-a`；业务字段 `upfrontMinor`, `perUnitMinor`, `shares`。
- `incoming-usage`：示例ID为 `usage-a`；业务字段 `month`, `territory`, `units`, `revision`。
- `incoming-legal-notice`：示例ID为 `dispute-a`；业务字段 `territory`, `use`, `effective`, `reason`。

`incoming-`类型及申请、提议记录只是可提交的输入事实，不表示已受理、已签认或已执行。对事实的审核、权限控制和业务后果没有在联调程序里实现。

演练权利和企业均为虚构；地域符号仅为软件匹配，不构成真实法律意见。

`fixtures/actors.json` 的token只供本地演练。应用应从已验证身份取得权限，不能信任请求自行声明的角色。
