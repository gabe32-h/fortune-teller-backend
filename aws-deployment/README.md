# Fortune Teller - AWS部署方案

本目录包含Fortune Teller应用在AWS上的完整部署方案和文档。

## 📁 目录结构

```
aws-deployment/
├── README.md                    # 本文档
├── cloudformation/              # CloudFormation部署方案
│   ├── cloudformation-simple.yaml    # CloudFormation模板
│   ├── deploy-cloudformation.sh      # 一键部署脚本
│   └── delete-stack.sh               # 一键删除脚本
├── terraform/                   # Terraform部署方案
│   └── main.tf                       # Terraform配置
└── docs/                        # 详细文档
    ├── DEPLOY_NOW.md                 # 快速开始指南 ⭐
    ├── CLOUDFORMATION_README.md      # CloudFormation快速参考
    ├── CLOUDFORMATION_DEPLOY.md      # CloudFormation详细步骤
    ├── AWS_DEPLOYMENT_SUMMARY.md     # AWS方案总结
    ├── AWS_QUICK_START.md            # Terraform快速开始
    ├── AWS_DEPLOYMENT_GUIDE.md       # 手动部署详细指南
    └── AWS_COST_OPTIMIZATION.md      # 成本优化建议
```

---

## 🚀 快速开始

### 推荐方案：CloudFormation简化部署

**适合测试环境，20分钟一键部署**

#### 方式1: AWS Console部署（最简单）⭐

1. 打开 AWS Console: https://console.aws.amazon.com/cloudformation/
2. 点击 "Create stack"
3. 上传 `cloudformation/cloudformation-simple.yaml`
4. 填写参数：
   - DBPassword: 数据库密码（至少8位）
   - JWTSecret: JWT密钥（至少32位）
5. 等待20分钟完成

#### 方式2: AWS CLI部署

```bash
cd cloudformation

aws cloudformation create-stack \
  --stack-name fortune-teller-test \
  --template-body file://cloudformation-simple.yaml \
  --parameters \
    ParameterKey=DBPassword,ParameterValue=YourPassword123! \
    ParameterKey=JWTSecret,ParameterValue=your-jwt-secret-32chars \
  --capabilities CAPABILITY_IAM \
  --region ap-southeast-1
```

#### 方式3: 使用部署脚本

```bash
cd cloudformation
./deploy-cloudformation.sh
```

---

## 📊 部署方案对比

| 方案 | 部署时间 | 月成本 | 适用场景 | 推荐度 |
|------|---------|--------|---------|--------|
| **CloudFormation简化版** | 20分钟 | $80-120 | 测试环境 | ⭐⭐⭐⭐⭐ |
| **Terraform完整版** | 30分钟 | $150-250 | 生产环境 | ⭐⭐⭐⭐ |
| **手动部署** | 2-4小时 | $150-250 | 学习理解 | ⭐⭐ |

---

## 📖 详细文档

### 快速参考
- **docs/DEPLOY_NOW.md** - 立即开始部署（所有命令） ⭐
- **docs/CLOUDFORMATION_README.md** - CloudFormation快速参考

### CloudFormation部署
- **docs/CLOUDFORMATION_DEPLOY.md** - CloudFormation详细步骤
- **cloudformation/cloudformation-simple.yaml** - 部署模板
- **cloudformation/deploy-cloudformation.sh** - 自动化脚本

### Terraform部署
- **docs/AWS_QUICK_START.md** - Terraform快速开始
- **terraform/main.tf** - Terraform配置

### 完整方案
- **docs/AWS_DEPLOYMENT_SUMMARY.md** - 所有方案总结
- **docs/AWS_DEPLOYMENT_GUIDE.md** - 手动部署完整指南
- **docs/AWS_COST_OPTIMIZATION.md** - 成本优化策略

---

## 💰 成本估算

### CloudFormation简化版（测试环境）
```
月度成本：$80-120

- ECS Fargate: $10/月
- RDS PostgreSQL (单AZ): $15/月
- ElastiCache Redis: $15/月
- ALB: $20/月
- NAT Gateway (单个): $35/月
- S3 + 其他: $10/月
```

### Terraform完整版（生产环境）
```
月度成本：$150-250

- ECS Fargate (4任务): $70/月
- RDS PostgreSQL (Multi-AZ): $30/月
- ElastiCache Redis: $15/月
- ALB: $20/月
- NAT Gateway (Multi-AZ): $70/月
- S3 + CloudFront: $20/月
- Secrets Manager + CloudWatch: $15/月
```

---

## 🎯 部署路线建议

### 阶段1: MVP测试（当前）
**目标**: 快速验证产品

```yaml
推荐方案: CloudFormation简化版
月成本: $100
部署时间: 20分钟
用户容量: 0-1,000

快速开始:
  1. 使用AWS Console上传CloudFormation模板
  2. 填写参数（密码和JWT密钥）
  3. 等待20分钟完成
  4. 构建并推送Docker镜像
  5. 部署前端到S3
```

### 阶段2: 产品增长（3-6个月）
**目标**: 提升可用性，支持更多用户

```yaml
推荐方案: Terraform完整版
月成本: $200-250
用户容量: 1,000-10,000

升级措施:
  1. 迁移到Multi-AZ部署
  2. 启用Auto Scaling
  3. 购买Savings Plans节省30%
  4. 配置CloudFront全球加速
```

### 阶段3: 规模化（1年后）
**目标**: 支持大规模用户

```yaml
推荐方案: Kubernetes + Multi-Region
月成本: $500-1,000
用户容量: 10,000+

优化措施:
  1. 迁移到EKS
  2. Multi-Region部署
  3. Redis Cluster
  4. 微服务架构
```

---

## 🔧 部署后操作

### 1. 构建并推送Docker镜像

```bash
# 登录ECR
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin YOUR_ECR_REPO

# 构建镜像
docker build -t backend:latest .
docker tag backend:latest YOUR_ECR_REPO:latest
docker push YOUR_ECR_REPO:latest

# 更新ECS服务
aws ecs update-service \
  --cluster fortune-teller-cluster \
  --service fortune-teller-backend-service \
  --force-new-deployment \
  --region ap-southeast-1
```

### 2. 运行数据库迁移

```bash
# 进入ECS任务执行迁移
aws ecs execute-command \
  --cluster fortune-teller-cluster \
  --task TASK-ID \
  --container backend \
  --interactive \
  --command "npm run db:migrate"
```

### 3. 部署前端

```bash
# 在前端仓库
npm run build
aws s3 sync dist/ s3://YOUR_FRONTEND_BUCKET/ --delete
```

---

## 📊 监控和维护

### 查看日志
```bash
aws logs tail /ecs/fortune-teller-backend --follow
```

### 查看服务状态
```bash
aws ecs describe-services \
  --cluster fortune-teller-cluster \
  --services fortune-teller-backend-service
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

### 使用脚本删除
```bash
cd cloudformation
./delete-stack.sh
```

### 手动删除
```bash
# 清空S3存储桶
aws s3 rm s3://YOUR_FRONTEND_BUCKET --recursive
aws s3 rm s3://YOUR_REPORTS_BUCKET --recursive

# 删除CloudFormation Stack
aws cloudformation delete-stack --stack-name fortune-teller-test

# 等待删除完成
aws cloudformation wait stack-delete-complete --stack-name fortune-teller-test
```

---

## 🔍 故障排查

### ECS任务无法启动
```bash
# 查看任务日志
aws logs tail /ecs/fortune-teller-backend --follow

# 查看任务详情
aws ecs describe-tasks --cluster fortune-teller-cluster --tasks TASK-ARN
```

### 健康检查失败
```bash
# 检查目标组健康
aws elbv2 describe-target-health --target-group-arn TARGET-GROUP-ARN

# 手动测试
curl http://ALB-DNS/api/v1/health
```

### Stack创建失败
```bash
# 查看失败事件
aws cloudformation describe-stack-events \
  --stack-name fortune-teller-test \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]' \
  --output table
```

---

## 📚 资源链接

### AWS文档
- [CloudFormation User Guide](https://docs.aws.amazon.com/cloudformation/)
- [ECS User Guide](https://docs.aws.amazon.com/ecs/)
- [RDS User Guide](https://docs.aws.amazon.com/rds/)

### 项目文档
- [项目总览](../README.md)
- [本地开发指南](../../SETUP_GUIDE.md)
- [API文档](http://localhost:3000/api-docs)

---

## 🆘 获取帮助

1. 查看 `docs/` 目录中的详细文档
2. 检查AWS Console的CloudFormation事件
3. 查看ECS任务日志
4. 提Issue到GitHub仓库

---

## 🎉 开始部署

推荐首次部署使用 **CloudFormation简化版**：

1. 阅读 `docs/DEPLOY_NOW.md`
2. 准备好AWS账号和凭证
3. 使用AWS Console上传模板
4. 等待20分钟完成
5. 开始使用！

**祝部署顺利！** 🚀
