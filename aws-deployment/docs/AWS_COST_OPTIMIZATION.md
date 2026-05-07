# Fortune Teller - AWS 成本优化指南

## 💰 成本优化策略

### 1. **MVP阶段成本优化（立即实施）**

#### 选项A：单AZ部署（节省~40%）
**月成本: ~$150**

```yaml
优化措施:
  - ✅ 使用单个NAT Gateway而非Multi-AZ ($35/月节省)
  - ✅ RDS使用Single-AZ而非Multi-AZ ($15/月节省)
  - ✅ ElastiCache单节点 (已优化)
  - ✅ ECS Fargate使用FARGATE_SPOT ($20/月节省)

权衡:
  - ❌ 可用性从99.9%降至99.5%
  - ❌ 单点故障风险增加
  - ✅ 适合MVP初期测试
```

#### 选项B：使用更小规格（节省~30%）
**月成本: ~$180**

```yaml
优化措施:
  - RDS: db.t4g.micro → db.t3.micro ($5/月节省)
  - ECS: 512 CPU/1024 MB → 256 CPU/512 MB ($20/月节省)
  - 使用Reserved Instances (1年承诺节省30%)

适用场景:
  - 初期用户少于1000人
  - 流量可预测
```

#### 选项C：使用AWS Free Tier（前12个月免费）
**月成本: ~$100（扣除免费额度）**

```yaml
AWS Free Tier包含:
  - EC2: 750小时/月 t2.micro或t3.micro
  - RDS: 750小时/月 db.t2.micro或db.t3.micro (Single-AZ)
  - S3: 5GB存储 + 20,000 GET + 2,000 PUT请求
  - CloudFront: 50GB数据传输
  - Lambda: 100万次请求 (如果使用Serverless)

注意:
  - 仅限新AWS账号
  - 前12个月有效
  - 超出部分按正常收费
```

---

### 2. **架构替代方案对比**

#### 方案1: 当前推荐架构（ECS + RDS）
**月成本: $253**
- 优点: 高可用、易扩展、托管服务
- 缺点: 成本较高
- 适合: 预期快速增长的应用

#### 方案2: Serverless架构（Lambda + Aurora Serverless）
**月成本: $80-150（根据流量）**

```yaml
组件:
  - 前端: S3 + CloudFront ($15)
  - 后端: Lambda + API Gateway ($20-60)
  - 数据库: Aurora Serverless v2 ($40-80)
  - 缓存: DynamoDB DAX或ElastiCache ($10)

优点:
  - 按使用量付费
  - 自动扩展到零
  - 低流量时极便宜

缺点:
  - 冷启动延迟(~1-3秒)
  - 改造成本高
  - 调试相对复杂
```

#### 方案3: App Runner + Aurora Serverless
**月成本: $100-180**

```yaml
组件:
  - AWS App Runner: $50-100
  - Aurora Serverless: $40-80
  - S3 + CloudFront: $15

优点:
  - 比ECS简单
  - 自动扩展
  - 容器化

缺点:
  - 控制力低于ECS
  - 自定义选项少
```

#### 方案4: EC2 + 自托管数据库（最便宜但最复杂）
**月成本: $50-80**

```yaml
组件:
  - EC2 t3.small Reserved Instance: $10/月
  - 自托管PostgreSQL在EC2: 包含在上述
  - 自托管Redis在EC2: 包含在上述
  - S3 + CloudFront: $15

优点:
  - 成本极低
  - 完全控制

缺点:
  - 需要管理服务器
  - 需要自己备份
  - 需要24/7监控
  - 高可用需要自己实现
```

---

### 3. **具体优化措施**

#### 3.1 计算层优化

```bash
# 使用FARGATE_SPOT节省70%
aws ecs create-service \
  --capacity-provider-strategy \
    capacityProvider=FARGATE_SPOT,weight=1,base=0

# 设置Auto Scaling根据CPU和流量
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/fortune-teller-cluster/fortune-teller-backend-service \
  --min-capacity 1 \
  --max-capacity 10

# CPU目标追踪
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/fortune-teller-cluster/fortune-teller-backend-service \
  --policy-name cpu-tracking \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    }
  }'

# 夜间缩减到最小容量
# 使用EventBridge定时触发
```

#### 3.2 数据库优化

```yaml
RDS优化:
  - 启用自动停止 (开发环境7天不用自动停止)
  - 使用Read Replica分离读写 (等用户量增大后)
  - 删除旧的快照 (保留7-30天)
  - 使用gp3存储而非gp2 (更便宜)

ElastiCache优化:
  - 使用t4g.micro而非t3.micro (ARM架构更便宜20%)
  - 设置TTL自动过期缓存
  - 监控缓存命中率，优化缓存策略
```

#### 3.3 网络优化

```yaml
数据传输成本优化:
  - 使用CloudFront缓存静态资源 (S3→CloudFront流量免费)
  - API响应使用gzip压缩 (减少50-70%传输)
  - 图片使用WebP格式 (减少30-50%大小)
  - 配置CloudFront长缓存时间
  - 使用VPC Endpoints避免NAT Gateway费用 (部分服务)

NAT Gateway优化:
  - 考虑使用单个NAT Gateway (节省$35/月)
  - 或使用NAT Instance (t4g.nano $3/月)
  - 使用VPC Endpoints访问AWS服务 (S3, DynamoDB免费)
```

#### 3.4 存储优化

```yaml
S3优化:
  - 启用Intelligent-Tiering (自动优化存储类)
  - 30天后转到Standard-IA
  - 90天后转到Glacier
  - 设置过期策略删除临时文件
  - 压缩PDF报告

RDS存储:
  - 定期清理测试数据
  - 归档旧数据到S3
  - 监控存储增长趋势
```

---

### 4. **成本监控和告警**

#### 设置成本预算

```bash
# 创建月度预算告警
aws budgets create-budget \
  --account-id 123456789012 \
  --budget '{
    "BudgetName": "fortune-teller-monthly-budget",
    "BudgetLimit": {
      "Amount": "300",
      "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [{
      "SubscriptionType": "EMAIL",
      "Address": "your-email@example.com"
    }]
  }]'

# 设置异常检测
aws ce create-anomaly-monitor \
  --anomaly-monitor '{
    "MonitorName": "fortune-teller-anomaly-monitor",
    "MonitorType": "DIMENSIONAL",
    "MonitorDimension": "SERVICE"
  }'
```

#### 使用Cost Explorer标签

```yaml
资源标签策略:
  标签所有资源:
    - Environment: production/staging/development
    - Project: fortune-teller
    - Component: frontend/backend/database
    - CostCenter: engineering

  然后在Cost Explorer按标签分析:
    - 哪个组件成本最高？
    - 环境间成本对比
    - 月度趋势分析
```

---

### 5. **推荐实施路线图**

#### 阶段1: MVP Launch (0-1000用户)
**目标月成本: $100-150**

```yaml
架构:
  - Single-AZ部署
  - db.t4g.micro (Single-AZ)
  - cache.t4g.micro
  - 1-2个Fargate任务
  - 单NAT Gateway

优化措施:
  - 使用AWS Free Tier
  - FARGATE_SPOT
  - 夜间缩减到0任务 (如果可接受)
```

#### 阶段2: Growth (1,000-10,000用户)
**目标月成本: $200-300**

```yaml
架构:
  - Multi-AZ部署 (高可用)
  - db.t4g.small (Multi-AZ)
  - cache.t4g.small
  - 2-6个Fargate任务 (Auto Scaling)
  - Multi-AZ NAT Gateway

优化措施:
  - 购买1年Reserved Instances (节省30%)
  - 启用CloudFront缓存
  - 优化数据库查询
```

#### 阶段3: Scale (10,000+用户)
**目标月成本: $500-1000**

```yaml
架构:
  - Multi-AZ + 多Region (中国+海外)
  - RDS Multi-AZ + Read Replica
  - Redis Cluster (HA)
  - 10-50个Fargate任务
  - 考虑迁移到Kubernetes (EKS)

优化措施:
  - Savings Plans (节省30-50%)
  - CDN深度优化
  - 数据库分片
  - 微服务架构
```

---

### 6. **成本对比表**

| 方案 | 月成本 | 可用性 | 扩展性 | 管理复杂度 | 推荐阶段 |
|------|--------|--------|--------|-----------|----------|
| **Serverless (Lambda)** | $80-150 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | MVP测试 |
| **App Runner** | $100-180 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | 快速启动 |
| **ECS单AZ** | $150 | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | MVP推荐 |
| **ECS Multi-AZ** | $253 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | 生产推荐 ⭐ |
| **自托管EC2** | $50-80 | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | 预算极紧 |

---

### 7. **实际操作：成本优化清单**

#### 立即可做（无需修改代码）：

- [ ] 启用AWS Cost Explorer并设置预算告警
- [ ] 为所有资源添加标签
- [ ] 删除未使用的EBS卷、快照、弹性IP
- [ ] 检查并删除旧的AMI和Docker镜像
- [ ] 设置S3生命周期策略
- [ ] 启用RDS和ElastiCache自动停止（非生产环境）
- [ ] 使用gp3替代gp2存储
- [ ] 启用CloudFront压缩
- [ ] 关闭未使用的环境

#### 需要一些工作：

- [ ] 迁移到FARGATE_SPOT
- [ ] 实施Auto Scaling策略
- [ ] 购买Savings Plans或Reserved Instances
- [ ] 优化Docker镜像大小
- [ ] 实施缓存策略
- [ ] 数据库查询优化
- [ ] API响应gzip压缩
- [ ] 图片CDN和格式优化

#### 长期规划：

- [ ] 考虑Serverless架构
- [ ] 实施数据归档策略
- [ ] 使用Spot Instances
- [ ] Multi-Region架构优化
- [ ] 考虑中国区部署（阿里云/腾讯云）

---

### 8. **常见问题**

**Q: 如何选择Region降低中国用户延迟？**

A: 推荐顺序：
1. **ap-southeast-1** (新加坡) - 延迟60-120ms，性价比最高 ⭐
2. ap-northeast-1 (东京) - 延迟80-150ms
3. ap-east-1 (香港) - 延迟30-80ms，但成本高25%
4. cn-north-1 (北京) - 延迟最低但需要ICP备案

**Q: 数据库备份是否额外收费？**

A:
- RDS自动备份（7天内）：免费
- 超过7天的备份：$0.095/GB/月
- 手动快照：$0.095/GB/月
- 建议保留7-14天自动备份即可

**Q: NAT Gateway太贵，有替代方案吗？**

A:
1. **VPC Endpoints** - S3和DynamoDB流量免费
2. **NAT Instance** - 使用t4g.nano ($3/月) + 流量费
3. **单NAT Gateway** - 节省$35/月（牺牲Multi-AZ）
4. **公共子网** - 如果安全需求不高（不推荐）

**Q: 如何估算流量成本？**

A: 数据传出定价（ap-southeast-1）:
- 前10TB: $0.12/GB
- 10-50TB: $0.085/GB
- 50-150TB: $0.082/GB

估算：10,000用户，每人每天5MB → 150GB/天 → 4.5TB/月 → $540/月

**优化方案：使用CloudFront，前1TB仅$0.14/GB**

---

## 💡 最终建议

### MVP阶段（推荐）：
- 使用 **ECS Single-AZ** 方案
- 月成本约 **$150**
- 等用户增长后再升级Multi-AZ

### 成长期（3-6个月后）：
- 升级到 **ECS Multi-AZ**
- 购买1年Savings Plans
- 月成本约 **$200-250**

### 扩展期（1年后）：
- 考虑按需优化架构
- 可能考虑Kubernetes或Serverless
- 多Region部署

---

**记住：过早优化是万恶之源！先验证产品市场契合度，再优化成本。** 🚀
