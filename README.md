# 联合专利许可的范围承诺与使用清分 · 联调资料

本项目收录联合专利许可的范围承诺与使用清分所需的合成业务资料，以及可在本机启动的协作方 HTTP 通道。所有机构、人员、权利、资金和设备编号均为合成数据。文件及接口约定见 [资料字典](docs/data.md) 和 [协作方协议](docs/partners.md)。

## 环境与运行

运行时为 Node.js 22.22.1，使用标准库，没有第三方 npm 依赖。`package-lock.json` 固定依赖清单。

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm test
STATE_DIR=/tmp/joint-license-service-state PORT=9090 npm run partners
```

`npm run build` 对现有联调程序进行语法检查。`npm test` 检查资料引用、文件摘要及协作方接单协议，包括响应丢失后的查询和重启保存；其通过范围限于这些现有能力，不代表应用业务验收已经完成。

启动后 `GET /health` 可查看通道列表。`PORT`、`HOST`、`STATE_DIR` 分别设置监听端口、地址和持久资料位置。默认状态在 `/tmp/vendor-state`，并行运行时为各实例选择不同端口与状态目录。不要把业务状态写回 fixtures。

## 容器

```sh
docker build -t joint-license-service:local .
docker run --rm joint-license-service:local npm test
docker run --rm -p 9090:9090 -v joint-license-service-state:/state -e STATE_DIR=/state joint-license-service:local
```

镜像基于固定摘要的 Node.js Linux 运行时。`support/` 是协作方协议服务及其自检，`fixtures/` 是输入资料和合成身份，`files/` 保存被引用文件。容器默认只启动协作方通道。主业务的接口、存储和启动入口以应用实现后补充的说明为准。

演练权利和企业均为虚构；地域符号仅为软件匹配，不构成真实法律意见。
