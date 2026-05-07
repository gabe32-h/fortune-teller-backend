# Fortune Teller - CloudFormation 快速部署指南

## 🚀 一键部署测试环境

本指南使用CloudFormation一键部署Fortune Teller完整测试环境。

**部署时间**: 约20-25分钟
**预计成本**: $80-120/月（测试环境，单AZ配置）

---

## 📋 包含的资源

✅ **网络层**
- VPC (10.0.0.0/16)
- 2个公共子网（ALB）
- 2个私有子网（ECS、RDS、Redis）
- Internet Gateway
- NAT Gateway（单个）
- 路由表配置

✅ **计算层**
- ECS Fargate集群
- ECS服务（1个任务，可扩展）
- Application Load Balancer
- 自动健康检查和重启

✅ **数据层**
- RDS PostgreSQL 15.4 (db.t4g.micro, 单AZ)
- ElastiCache Redis 7.0 (cache.t4g.micro)
- 自动备份（7天保留）

✅ **存储层**
- S3前端静态网站托管
- S3 PDF报告存储（90天自动删除）
- ECR Docker镜像仓库

✅ **安全配置**
- 安全组（最小权限）
- IAM角色
- 数据库加密
- 私有子网隔离

---

## 🎯 快速开始（3步）

### Step 1: 准备AWS环境（2分钟）

```bash
# 1. 确保AWS CLI已安装并配置
aws --version
aws configure list

# 2. 验证AWS凭证
aws sts get-caller-identity

# 应该看到您的账号信息
```

### Step 2: 部署CloudFormation Stack（20分钟）

```bash
# 方法A: 使用AWS CLI部署（推荐）
cd /workspace

aws cloudformation create-stack \
  --stack-name fortune-teller-test \
  --template-body file://cloudformation-simple.yaml \
  --parameters \
    ParameterKey=ProjectName,ParameterValue=fortune-teller \
    ParameterKey=Environment,ParameterValue=test \
    ParameterKey=DBPassword,ParameterValue=YourStrongPassword123! \
    ParameterKey=JWTSecret,ParameterValue=your-super-secret-jwt-key-min-32-characters-long \
  --capabilities CAPABILITY_IAM \
  --region ap-southeast-1

# 等待部署完成（约20-25分钟）
aws cloudformation wait stack-create-complete \
  --stack-name fortune-teller-test \
  --region ap-southeast-1

# 查看输出
aws cloudformation describe-stacks \
  --stack-name fortune-teller-test \
  --region ap-southeast-1 \
  --query 'Stacks[0].Outputs'
```

**方法B: 使用AWS Console部署**

1. 打开AWS Console: https://console.aws.amazon.com/cloudformation/
2. 点击 "Create stack" → "With new resources"
3. 上传 `cloudformation-simple.yaml` 文件
4. 填写参数：
   - Stack name: `fortune-teller-test`
   - DBPassword: 输入强密码
   - JWTSecret: 输入32位以上密钥
5. 勾选 "I acknowledge that AWS CloudFormation might create IAM resources"
6. 点击 "Create stack"
7. 等待20-25分钟完成

### Step 3: 构建并推送Docker镜像（5分钟）

```bash
# 1. 获取ECR仓库地址
export ECR_REPO=$(aws cloudformation describe-stacks \
  --stack-name fortune-teller-test \
  --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryURI`].OutputValue' \
  --output text)

echo "ECR Repository: $ECR_REPO"

# 2. 登录ECR
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin ${ECR_REPO%%/*}

# 3. 构建Docker镜像
cd /workspace/fortune-teller-backend
docker build -t fortune-teller-backend:latest .

# 4. 打标签
docker tag fortune-teller-backend:latest $ECR_REPO:latest

# 5. 推送到ECR
docker push $ECR_REPO:latest

# 6. 强制更新ECS服务（拉取新镜像）
aws ecs update-service \
  --cluster fortune-teller-cluster \
  --service fortune-teller-backend-service \
  --force-new-deployment \
  --region ap-southeast-1

# 等待服务更新完成（约3-5分钟）
aws ecs wait services-stable \
  --cluster fortune-teller-cluster \
  --services fortune-teller-backend-service \
  --region ap-southeast-1

echo "✅ 后端部署完成！"
```

---

## 🌐 部署前端

### Step 4: 部署前端到S3（3分钟）

```bash
# 1. 获取前端S3存储桶名称和ALB地址
export FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name fortune-teller-test \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)

export ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name fortune-teller-test \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text)

echo "Frontend Bucket: $FRONTEND_BUCKET"
echo "ALB DNS: $ALB_DNS"

# 2. 配置前端环境变量
cd /workspace/fortune-teller-frontend
cat > .env.production <<EOF
VITE_API_BASE_URL=http://${ALB_DNS}/api/v1
VITE_APP_NAME=Fortune Teller
EOF

# 3. 构建前端
npm install
npm run build

# 4. 上传到S3
aws s3 sync dist/ s3://${FRONTEND_BUCKET}/ --delete

echo "✅ 前端部署完成！"
```

---

## 🔍 验证部署

### 检查所有服务状态

```bash
# 1. 获取所有输出
aws cloudformation describe-stacks \
  --stack-name fortune-teller-test \
  --query 'Stacks[0].Outputs' \
  --output table

# 2. 测试后端健康检查
export API_URL=$(aws cloudformation describe-stacks \
  --stack-name fortune-teller-test \
  --query 'Stacks[0].Outputs[?OutputKey==`APIHealthCheck`].OutputValue' \
  --output text)

curl $API_URL
# 应该返回: {"status":"ok"}

# 3. 测试数据库连接
curl http://${ALB_DNS}/api/v1/health/db
# 应该返回: {"status":"ok","database":"connected"}

# 4. 测试Redis连接
curl http://${ALB_DNS}/api/v1/health/redis
# 应该返回: {"status":"ok","redis":"connected"}

# 5. 获取前端URL
export FRONTEND_URL=$(aws cloudformation describe-stacks \
  --stack-name fortune-teller-test \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendURL`].OutputValue' \
  --output text)

echo "🎉 部署成功！"
echo ""
echo "📱 前端访问: $FRONTEND_URL"
echo "🔧 后端API: http://${ALB_DNS}/api/v1"
echo "📊 API文档: http://${ALB_DNS}/api-docs"
```

---

## 📊 部署监控

### 查看ECS服务状态

```bash
# 查看ECS任务
aws ecs list-tasks \
  --cluster fortune-teller-cluster \
  --service-name fortune-teller-backend-service

# 查看服务详情
aws ecs describe-services \
  --cluster fortune-teller-cluster \
  --services fortune-teller-backend-service

# 查看日志
aws logs tail /ecs/fortune-teller-backend --follow
```

### 查看CloudFormation Stack事件

```bash
# 查看stack创建过程
aws cloudformation describe-stack-events \
  --stack-name fortune-teller-test \
  --max-items 20
```

---

## 🔧 常用操作

### 更新后端代码

```bash
# 1. 构建新镜像
cd /workspace/fortune-teller-backend
docker build -t fortune-teller-backend:latest .

# 2. 推送到ECR
docker tag fortune-teller-backend:latest $ECR_REPO:latest
docker push $ECR_REPO:latest

# 3. 强制ECS更新
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
aws s3 sync dist/ s3://${FRONTEND_BUCKET}/ --delete
```

### 扩容/缩容ECS任务

```bash
# 扩容到3个任务
aws ecs update-service \
  --cluster fortune-teller-cluster \
  --service fortune-teller-backend-service \
  --desired-count 3

# 缩容到1个任务
aws ecs update-service \
  --cluster fortune-teller-cluster \
  --service fortune-teller-backend-service \
  --desired-count 1
```

### 查看成本

```bash
# 查看当前月成本
aws ce get-cost-and-usage \
  --time-period Start=$(date -u +%Y-%m-01),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://<(echo '{
    "Tags": {
      "Key": "aws:cloudformation:stack-name",
      "Values": ["fortune-teller-test"]
    }
  }')
```

---

## 🗑️ 删除Stack

### 完全删除所有资源

```bash
# ⚠️ 警告：此操作会删除所有数据！

# 1. 清空S3存储桶（CloudFormation无法删除非空S3桶）
aws s3 rm s3://${FRONTEND_BUCKET} --recursive
aws s3 rm s3://$(aws cloudformation describe-stacks \
  --stack-name fortune-teller-test \
  --query 'Stacks[0].Outputs[?OutputKey==`ReportsBucketName`].OutputValue' \
  --output text) --recursive

# 2. 删除ECR镜像
aws ecr batch-delete-image \
  --repository-name fortune-teller/backend \
  --image-ids imageTag=latest

# 3. 删除CloudFormation Stack
aws cloudformation delete-stack \
  --stack-name fortune-teller-test

# 4. 等待删除完成（约10-15分钟）
aws cloudformation wait stack-delete-complete \
  --stack-name fortune-teller-test

echo "✅ Stack删除完成！"
```

---

## 🔧 故障排查

### 问题1: Stack创建失败

```bash
# 查看失败原因
aws cloudformation describe-stack-events \
  --stack-name fortune-teller-test \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'

# 常见原因：
# - 配额限制（新账号可能有限制）
# - 参数错误（密码太短等）
# - 区域不支持某些实例类型

# 解决方法：
# 1. 删除失败的stack
aws cloudformation delete-stack --stack-name fortune-teller-test

# 2. 修改参数后重新创建
```

### 问题2: ECS任务无法启动

```bash
# 查看任务失败原因
aws ecs describe-tasks \
  --cluster fortune-teller-cluster \
  --tasks $(aws ecs list-tasks --cluster fortune-teller-cluster --query 'taskArns[0]' --output text)

# 查看容器日志
aws logs tail /ecs/fortune-teller-backend --follow

# 常见原因：
# - Docker镜像未推送或标签错误
# - 数据库连接失败
# - 环境变量配置错误

# 解决方法：检查TaskDefinition中的镜像地址和环境变量
```

### 问题3: 健康检查失败

```bash
# 检查目标组健康状态
aws elbv2 describe-target-health \
  --target-group-arn $(aws elbv2 describe-target-groups \
    --names fortune-teller-tg \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)

# 常见原因：
# - 应用未正确启动
# - 健康检查路径错误
# - 安全组配置错误

# 解决方法：
# 1. 检查应用日志
# 2. 手动curl测试健康检查端点
# 3. 验证安全组规则
```

### 问题4: 前端无法访问后端

```bash
# 检查CORS配置
# 前端环境变量中的API地址必须匹配后端CORS_ORIGIN

# 查看当前配置
aws ecs describe-task-definition \
  --task-definition fortune-teller-backend \
  --query 'taskDefinition.containerDefinitions[0].environment'

# 如果需要更新CORS配置，需要更新Stack
```

---

## 📋 参数说明

### CloudFormation参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| **ProjectName** | fortune-teller | 项目名称，用于资源命名 |
| **Environment** | test | 环境名称（test/staging/production） |
| **DBPassword** | - | RDS数据库密码（至少8位） |
| **JWTSecret** | - | JWT密钥（至少32位） |
| **VpcCIDR** | 10.0.0.0/16 | VPC CIDR范围 |

### 修改参数

```bash
# 更新Stack参数（会触发资源重建）
aws cloudformation update-stack \
  --stack-name fortune-teller-test \
  --use-previous-template \
  --parameters \
    ParameterKey=ProjectName,UsePreviousValue=true \
    ParameterKey=Environment,UsePreviousValue=true \
    ParameterKey=DBPassword,ParameterValue=NewPassword123! \
    ParameterKey=JWTSecret,UsePreviousValue=true \
  --capabilities CAPABILITY_IAM
```

---

## 💰 成本估算（测试环境）

```
月度成本明细：

计算层:
  - ECS Fargate (0.25 vCPU, 0.5GB, 1任务): $10/月
  - NAT Gateway (单个): $35/月

数据层:
  - RDS PostgreSQL (db.t4g.micro, 单AZ): $15/月
  - ElastiCache Redis (cache.t4g.micro): $15/月

负载均衡:
  - Application Load Balancer: $20/月

存储:
  - S3 存储和请求: $5/月
  - ECR: $1/月

网络:
  - 数据传输: $10/月

总计: ~$110/月

优化建议:
- 开发时停止不用的资源
- 使用Spot实例（Fargate Spot）
- 定期清理旧镜像和日志
```

---

## 🎯 下一步

部署成功后：

1. **运行数据库迁移**
   ```bash
   # 在ECS任务中运行
   aws ecs run-task \
     --cluster fortune-teller-cluster \
     --task-definition fortune-teller-backend \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx]}" \
     --overrides '{
       "containerOverrides": [{
         "name": "backend",
         "command": ["npm", "run", "db:migrate"]
       }]
     }'
   ```

2. **设置CI/CD**
   - 配置GitHub Actions自动部署
   - 参考之前创建的workflow文件

3. **添加域名和SSL**
   - 在Route 53配置域名
   - 使用ACM申请SSL证书
   - 更新ALB监听器使用HTTPS

4. **启用监控**
   - 查看CloudWatch日志
   - 设置告警（可选）

5. **实现核心功能**
   - 算命算法
   - AI集成
   - 支付系统

---

## 📚 相关文档

- **cloudformation-simple.yaml** - 本部署模板
- **AWS_DEPLOYMENT_GUIDE.md** - 详细部署指南
- **AWS_COST_OPTIMIZATION.md** - 成本优化建议
- **AWS_QUICK_START.md** - 快速开始指南

---

## 🆘 需要帮助？

1. 查看CloudFormation事件日志
2. 查看ECS任务日志
3. 检查安全组规则
4. 验证IAM权限

如有问题，随时告诉我！😊

---

## 🎉 恭喜！

您已成功使用CloudFormation一键部署Fortune Teller测试环境！

**接下来可以：**
- 访问前端开始测试
- 开发核心算命功能
- 配置CI/CD自动部署
- 邀请用户测试

祝开发顺利！🚀✨
