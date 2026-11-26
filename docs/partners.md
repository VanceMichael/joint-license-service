# 协作方 HTTP 通道

通道仅记录模拟协作方的接单事实，不决定本项目业务是否成立。每个独立STATE_DIR保存自己的原子替换日志，重启后可继续查询。

## 发送与回查

`POST /vendors/{provider}/commands` 接收JSON对象；必填请求头 `Idempotency-Key` 是调用方为一次外部指令分配的稳定标识，只允许字母、数字、点、横线和下划线。同一provider与标识的相同正文返回同一记录，JSON对象字段顺序不影响相等判断；正文改变返回409。缺少必填业务字段返回422，未知provider返回404。

新指令返回202与 `key/provider/payload/fingerprint/status/result/revision`，初始status为accepted，result为null。accepted仅证明协作方收到指令。`GET /vendors/{provider}/commands/{key}` 返回当前记录；404表示该外部指令尚未记录。协议终态completed、rejected、cancelled的业务含义须结合result判定。

## 可用协作方

- `escrow` 必填字段：`contractId`, `payer`, `amountMinor`。正文样例位于 `fixtures/vendors.json`。
- `signature` 必填字段：`contractId`, `partyId`, `termsDigest`。正文样例位于 `fixtures/vendors.json`。

escrow回传transferId、paidMinor、refundedMinor；signature回传签署方与termsDigest。

撤回、释放或退款可发送新指令，正文保留相应必填标识并增加 `action` 和 `originalKey`。同一指令的查询始终使用原key，不能用新key查询旧结果。协作方是否完成该动作由回传结果表达，不在接收时假定成功。

## 本地控制

合成控制端 `PUT /control/{provider}/commands/{key}` 使用 `Authorization: Bearer synthetic-control`，可设置status和result，revision随每次控制更新增加。控制端只供联调驱动模拟真实协作方，不是业务人员审批接口，不应作为主业务捷径调用。驱动可将部分明细设为accepted、部分设为rejected，或保持未决。

发送指令时使用 `X-Synthetic-Response: disconnect` 可模拟协作方已落盘但连接丢失；随后用原key查询可看到accepted。状态保存于独立目录；正常终止重启不会清除记录。状态文件损坏时启动失败，不悄悄回到空状态。

`npm test` 在临时目录实际检验接单、冲突、控制权限、落盘和失联后回查，结束时清理。业务应用需自行处理这些事实与用户承诺之间的关系。
