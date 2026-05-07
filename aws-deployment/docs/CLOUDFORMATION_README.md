# Fortune Teller - CloudFormation 简化部署方案

## 🎯 概述

本方案提供了**最简化的CloudFormation一键部署**，专为测试环境设计，去除了Secrets Manager和高级CloudWatch功能，降低成本和复杂度。

**特点：**
- ✅ 一个YAML文件包含所有配置
- ✅ 20分钟一键部署完整环境
- ✅ 成本约$80-120/月（测试环境）
- ✅ 无需Secrets Manager（环境变量直接配置）
- ✅ 基础日志（7天保留）

---

## 📦 部署方案对比

| 特性 | CloudFormation简化版 | Terraform完整版 | 手动部署 |
|------|---------------------|----------------|---------|
| **部署时间** | 20分钟 | 30分钟 | 2-4小时 |
| **复杂度** | ⭐ 简单 | ⭐⭐ 中等 | ⭐⭐⭐⭐ 复杂 |
| **月成本** | $80-120 | $150-250 | $150-250 |
| **适用场景** | 测试环境 | 生产环境 | 学习理解 |
| **Secrets Manager** | ❌ 不使用 | ✅ 使用 | ✅ 使用 |
| **高级监控** | ❌ 基础 | ✅ 完整 | ✅ 完整 |
| **Multi-AZ** | ❌ 单AZ | ✅ Multi-AZ | 可选 |

---

## 🚀 三种部署方式

### 方式1: 一键脚本部署（最简单）⭐

```bash
# 1. 进入工作目录
cd /workspace

# 2. 运行部署脚本
./deploy-cloudformation.sh

# 按提示输入：
# - Stack名称（默认：fortune-teller-test）
# - AWS Region（默认：ap-southeast-1）
# - 数据库密码（至少8位）
# - JWT密钥（至少32位）

# 3. 等待20分钟完成
```

### 方式2: AWS CLI手动部署

```bash
# 部署Stack
aws cloudformation create-stack \
  --stack-name fortune-teller-test \
  --template-body file://cloudformation-simple.yaml \
  --parameters \
    ParameterKey=DBPassword,ParameterValue=YourPassword123! \
    ParameterKey=JWTSecret,ParameterValue=your-super-secret-jwt-key-32chars \
  --capabilities CAPABILITY_IAM \
  --region ap-southeast-1

# 等待完成
aws cloudformation wait stack-create-complete \
  --stack-name fortune-teller-test \
  --region ap-southeast-1
```

### 方式3: AWS Console部署

1. 打开: https://console.aws.amazon.com/cloudformation/
2. 点击 "Create stack"
3. 上传 `cloudformation-simple.yaml`
4. 填写参数
5. 等待完成

---

## 📋 包含的AWS资源

### 网络层（7个资源）
- VPC (10.0.0.0/16)
- 2个公共子网 + 2个私有子网
- Internet Gateway
- NAT Gateway（单个）
- 路由表配置

### 计算层（8个资源）
- ECS Fargate集群
- ECS服务（1个任务）
- Application Load Balancer
- Target Group
- IAM角色（执行角色 + 任务角色）

### 数据层（4个资源）
- RDS PostgreSQL 15.4 (db.t4g.micro)
- ElastiCache Redis 7.0 (cache.t4g.micro)
- 数据库子网组
- Redis子网组

### 存储层（3个资源）
- S3前端静态网站
- S3 PDF报告存储
- ECR Docker镜像仓库

### 安全层（4个资源）
- ALB安全组
- ECS安全组
- RDS安全组
- Redis安全组

### 日志（1个资源）
- CloudWatch日志组（7天保留）

**总计：27个AWS资源**

---

## 💰 成本明细

```
测试环境月度成本（单AZ）：

计算层:
  - ECS Fargate (0.25 vCPU, 0.5GB): $10/月
  - NAT Gateway: $35/月
  - ALB: $20/月

数据层:
  - RDS PostgreSQL (db.t4g.micro): $15/月
  - ElastiCache Redis (cache.t4g.micro): $15/月

存储:
  - S3 存储和请求: $5/月
  - ECR: $1/月

网络:
  - 数据传输: $10/月

日志:
  - CloudWatch基础日志: $3/月

总计: ~$114/月

优化空间:
✅ 使用AWS Free Tier（新账号前12月）
✅ 夜间停止不用的资源（节省50%）
✅ 使用Fargate Spot（节省70%）
```

---

## 📊 输出信息

部署完成后，Stack会输出以下信息：

| 输出 | 说明 | 示例 |
|------|------|------|
| **LoadBalancerURL** | 后端API地址 | http://xxx.elb.amazonaws.com |
| **APIHealthCheck** | 健康检查地址 | http://xxx.elb.amazonaws.com/api/v1/health |
| **FrontendURL** | 前端网站地址 | http://xxx.s3-website-ap-southeast-1.amazonaws.com |
| **ECRRepositoryURI** | Docker镜像仓库 | 123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/... |
| **DatabaseEndpoint** | 数据库端点 | xxx.rds.amazonaws.com:5432 |
| **RedisEndpoint** | Redis端点 | xxx.cache.amazonaws.com:6379 |

获取输出：
```bash
aws cloudformation describe-stacks \
  --stack-name fortune-teller-test \
  --query 'Stacks[0].Outputs' \
  --output table
```

---

## 🔧 常用操作

### 更新后端代码

```bash
# 1. 构建镜像
cd /workspace/fortune-teller-backend
docker build -t backend:latest .

# 2. 推送到ECR
export ECR_REPO=$(aws cloudformation describe-stacks \
  --stack-name fortune-teller-test \
  --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryURI`].OutputValue' \
  --output text)

aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin ${ECR_REPO%%/*}

docker tag backend:latest $ECR_REPO:latest
docker push $ECR_REPO:latest

# 3. 更新ECS服务
aws ecs update-service \
  --cluster fortune-teller-cluster \
  --service fortune-teller-backend-service \
  --force-new-deployment \
  --region ap-southeast-1
```

### 更新前端代码

```bash
cd /workspace/fortune-teller-frontend
npm run build

export FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name fortune-teller-test \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)

aws s3 sync dist/ s3://${FRONTEND_BUCKET}/ --delete
```

### 查看日志

```bash
# 实时查看后端日志
aws logs tail /ecs/fortune-teller-backend --follow

# 查看最近100行
aws logs tail /ecs/fortune-teller-backend --since 10m
```

### 扩容/缩容

```bash
# 扩容到3个任务
aws ecs update-service \
  --cluster fortune-teller-cluster \
  --service fortune-teller-backend-service \
  --desired-count 3

# 缩容到0（省钱）
aws ecs update-service \
  --cluster fortune-teller-cluster \
  --service fortune-teller-backend-service \
  --desired-count 0
```

---

## 🗑️ 删除资源

### 使用脚本删除（推荐）

```bash
./delete-stack.sh

# 按提示确认删除
# 等待10-15分钟完成
```

### 手动删除

```bash
# 1. 清空S3
aws s3 rm s3://frontend-bucket --recursive
aws s3 rm s3://reports-bucket --recursive

# 2. 删除Stack
aws cloudformation delete-stack \
  --stack-name fortune-teller-test

# 3. 等待完成
aws cloudformation wait stack-delete-complete \
  --stack-name fortune-teller-test
```

---

## 🔍 故障排查

### ECS任务无法启动

```bash
# 查看任务状态
aws ecs describe-tasks \
  --cluster fortune-teller-cluster \
  --tasks $(aws ecs list-tasks \
    --cluster fortune-teller-cluster \
    --query 'taskArns[0]' \
    --output text)

# 查看日志
aws logs tail /ecs/fortune-teller-backend --follow

# 常见原因：
# - Docker镜像未推送
# - 数据库连接失败
# - 环境变量错误
```

### 健康检查失败

```bash
# 检查目标组健康
aws elbv2 describe-target-health \
  --target-group-arn $(aws elbv2 describe-target-groups \
    --names fortune-teller-tg \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)

# 手动测试健康检查
curl http://ALB-DNS/api/v1/health
```

### Stack创建失败

```bash
# 查看失败事件
aws cloudformation describe-stack-events \
  --stack-name fortune-teller-test \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]' \
  --output table

# 常见原因：
# - 参数配置错误（密码太短等）
# - 配额限制
# - Region不支持某些资源类型
```

---

## 📚 文件说明

| 文件 | 说明 |
|------|------|
| **cloudformation-simple.yaml** | CloudFormation模板（核心） |
| **deploy-cloudformation.sh** | 一键部署脚本 |
| **delete-stack.sh** | 一键删除脚本 |
| **CLOUDFORMATION_DEPLOY.md** | 详细部署指南 |
| **CLOUDFORMATION_README.md** | 本文档 |

---

## 🎯 下一步

部署成功后：

1. **验证部署**
   ```bash
   curl http://ALB-DNS/api/v1/health
   ```

2. **运行数据库迁移**
   ```bash
   # 进入ECS任务执行
   aws ecs execute-command \
     --cluster fortune-teller-cluster \
     --task TASK-ID \
     --container backend \
     --interactive \
     --command "npm run db:migrate"
   ```

3. **访问应用**
   - 前端：访问FrontendURL
   - API文档：http://ALB-DNS/api-docs

4. **配置CI/CD**
   - 使用GitHub Actions自动部署
   - 参考 `.github/workflows/` 文件

5. **实现核心功能**
   - 算命算法开发
   - AI集成
   - 支付系统

---

## 🆚 与完整方案对比

| 特性 | 简化版（本方案） | 完整版 |
|------|----------------|--------|
| Secrets Manager | ❌ | ✅ |
| CloudWatch高级功能 | ❌ | ✅ |
| Multi-AZ高可用 | ❌ | ✅ |
| Auto Scaling | ❌ | ✅ |
| 详细监控告警 | ❌ | ✅ |
| 成本 | $80-120/月 | $150-250/月 |
| 适用场景 | 测试/开发 | 生产环境 |
| 部署复杂度 | 低 | 中 |

**建议：**
- 测试阶段使用本方案（简化版）
- 有付费用户后升级到完整版

---

## ❓ 常见问题

**Q: 为什么不用Secrets Manager？**
A: 测试环境不需要，直接用环境变量更简单。生产环境建议使用。

**Q: 为什么是单AZ？**
A: 测试环境单AZ足够，节省$35/月NAT Gateway费用。

**Q: 日志保留多久？**
A: 7天。可以修改模板中的RetentionInDays参数。

**Q: 可以自动扩展吗？**
A: 当前配置固定1个任务。可以手动修改或添加Auto Scaling配置。

**Q: 如何升级到生产环境？**
A: 修改参数Environment=production，增加资源配置，启用Multi-AZ。

---

## 📞 获取帮助

1. 查看详细文档：`CLOUDFORMATION_DEPLOY.md`
2. 查看AWS文档：https://docs.aws.amazon.com/cloudformation/
3. 查看CloudFormation事件日志
4. 直接问我！😊

---

## 🎉 开始部署

选择您的方式：

```bash
# 方式1: 一键脚本（推荐）
./deploy-cloudformation.sh

# 方式2: 手动AWS CLI
aws cloudformation create-stack --stack-name fortune-teller-test ...

# 方式3: AWS Console
# 访问 https://console.aws.amazon.com/cloudformation/
```

**预计20分钟后，您就有一个完整的测试环境了！** 🚀

祝部署顺利！有问题随时问我！✨
