# 🚀 Fortune Teller - AWS 快速部署指南

## 30分钟快速上手 AWS 部署

本指南帮助您用最快的方式将Fortune Teller部署到AWS。

---

## 📋 前置清单

- [ ] AWS账号（建议新账号使用Free Tier）
- [ ] 信用卡（AWS验证需要）
- [ ] 域名（可选，可先用AWS提供的域名）
- [ ] GitHub账号（已有）

---

## 🎯 三种部署方案对比

### 方案A：手动部署（推荐学习）
- **时间**: 2-4小时
- **成本**: $150-250/月
- **难度**: ⭐⭐⭐⭐
- **优点**: 完全理解架构
- **缺点**: 步骤繁琐，容易出错

### 方案B：Terraform自动部署（推荐生产）⭐
- **时间**: 30-60分钟
- **成本**: $150-250/月
- **难度**: ⭐⭐⭐
- **优点**: 一键部署，可复现
- **缺点**: 需要学习Terraform基础

### 方案C：AWS App Runner（最简单）
- **时间**: 15-30分钟
- **成本**: $100-180/月
- **难度**: ⭐⭐
- **优点**: 极简部署
- **缺点**: 功能受限

---

## 🚀 方案B：Terraform快速部署（推荐）

### Step 1: 安装工具（5分钟）

```bash
# 安装AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# 安装Terraform
wget https://releases.hashicorp.com/terraform/1.7.0/terraform_1.7.0_linux_amd64.zip
unzip terraform_1.7.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# 验证安装
aws --version
terraform --version
```

### Step 2: 配置AWS凭证（2分钟）

```bash
# 在AWS Console创建IAM用户
# 1. 访问: https://console.aws.amazon.com/iam/
# 2. 创建用户，启用"Programmatic access"
# 3. 附加权限: AdministratorAccess (临时，生产环境使用最小权限)
# 4. 保存Access Key和Secret Key

# 配置AWS CLI
aws configure
# AWS Access Key ID: 输入您的Key
# AWS Secret Access Key: 输入您的Secret
# Default region: ap-southeast-1
# Default output format: json
```

### Step 3: 准备Terraform配置（5分钟）

```bash
cd /workspace/terraform-aws

# 创建terraform.tfvars文件
cat > terraform.tfvars <<EOF
aws_region    = "ap-southeast-1"
environment   = "production"
project_name  = "fortune-teller"
db_password   = "ChangeMe123!StrongPassword"
jwt_secret    = "your-super-secret-jwt-key-min-32-chars"
EOF

# 初始化Terraform
terraform init
```

### Step 4: 预览部署计划（2分钟）

```bash
# 查看将要创建的资源
terraform plan

# 应该看到类似输出：
# Plan: 45 to add, 0 to change, 0 to destroy.
```

### Step 5: 执行部署（15-20分钟）

```bash
# 开始部署
terraform apply

# 输入 "yes" 确认
# 等待约15-20分钟...

# 部署完成后，记录输出的信息：
# - ALB DNS Name
# - RDS Endpoint
# - Redis Endpoint
# - ECR Repository URL
```

### Step 6: 构建并推送Docker镜像（5分钟）

```bash
# 登录ECR
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin \
  $(terraform output -raw ecr_repository_url | cut -d'/' -f1)

# 构建后端镜像
cd /workspace/fortune-teller-backend
docker build -t fortune-teller-backend .

# 打标签
docker tag fortune-teller-backend:latest \
  $(cd /workspace/terraform-aws && terraform output -raw ecr_repository_url):latest

# 推送到ECR
docker push $(cd /workspace/terraform-aws && terraform output -raw ecr_repository_url):latest
```

### Step 7: 创建ECS服务（需要手动或使用AWS Console）

```bash
# 方式1: 使用AWS Console (推荐首次)
# 1. 访问 ECS Console: https://console.aws.amazon.com/ecs/
# 2. 选择集群: fortune-teller-cluster
# 3. 创建服务，选择刚创建的任务定义
# 4. 配置Auto Scaling和Load Balancer

# 方式2: 使用AWS CLI (需要先创建任务定义)
# 参考 AWS_DEPLOYMENT_GUIDE.md 的详细步骤
```

### Step 8: 部署前端（5分钟）

```bash
# 构建前端
cd /workspace/fortune-teller-frontend

# 更新环境变量
cat > .env.production <<EOF
VITE_API_BASE_URL=http://$(cd /workspace/terraform-aws && terraform output -raw alb_dns_name)/api/v1
VITE_APP_NAME=Fortune Teller
EOF

# 构建
npm run build

# 上传到S3
aws s3 sync dist/ s3://$(cd /workspace/terraform-aws && terraform output -raw s3_frontend_bucket)/ --delete

# 访问应用
echo "Frontend URL: http://$(cd /workspace/terraform-aws && terraform output -raw s3_frontend_bucket).s3-website-ap-southeast-1.amazonaws.com"
```

### Step 9: 配置域名和SSL（可选，10分钟）

```bash
# 在Route 53购买域名或使用现有域名
# 在ACM申请SSL证书
# 配置CloudFront指向S3和ALB
# 详见 AWS_DEPLOYMENT_GUIDE.md
```

---

## ⚡ 方案C：App Runner 极简部署

如果您想最快速度上线测试，使用App Runner：

### 1. 准备Dockerfile（已有）

```dockerfile
# /workspace/fortune-teller-backend/Dockerfile 已经创建好
```

### 2. 使用AWS Console部署

```bash
# 1. 推送代码到GitHub (已完成)
# 2. 访问 App Runner Console: https://console.aws.amazon.com/apprunner/
# 3. 点击"Create service"
# 4. 选择"Source code repository" → GitHub
# 5. 连接GitHub账号，选择fortune-teller-backend仓库
# 6. 配置:
#    - Port: 3000
#    - Environment variables: 添加数据库连接等
# 7. 点击"Create & deploy"
# 8. 等待5-10分钟部署完成
```

### 3. 部署前端到S3

```bash
# 同方案B的Step 8
```

**App Runner成本**: $0.064/小时 (~$46/月) + 请求费用

---

## 🔍 部署验证

部署完成后，逐一检查：

```bash
# 1. 检查后端健康
curl http://your-alb-dns-name/api/v1/health
# 应返回: {"status":"ok"}

# 2. 检查数据库连接
curl http://your-alb-dns-name/api/v1/health/db
# 应返回: {"status":"ok","database":"connected"}

# 3. 检查Redis连接
curl http://your-alb-dns-name/api/v1/health/redis
# 应返回: {"status":"ok","redis":"connected"}

# 4. 访问前端
# 在浏览器打开 S3网站URL 或 CloudFront URL

# 5. 测试注册登录
# 在前端注册新用户，测试登录功能
```

---

## 🎯 常见部署问题

### 问题1: Terraform apply失败

```bash
# 检查错误信息
terraform show

# 常见原因:
# - AWS凭证配置错误
# - Region不支持某些服务
# - 配额限制 (新账号可能有限制)

# 解决方法:
# 1. 检查 aws configure
# 2. 申请提高配额
# 3. 换Region试试
```

### 问题2: Docker镜像推送失败

```bash
# 重新登录ECR
aws ecr get-login-password | docker login --username AWS --password-stdin YOUR_ECR_URL

# 检查镜像是否构建成功
docker images | grep fortune-teller

# 检查网络连接
ping aws.amazon.com
```

### 问题3: ECS任务无法启动

```bash
# 查看任务日志
aws logs tail /ecs/fortune-teller-backend --follow

# 常见原因:
# - 环境变量配置错误
# - 数据库连接失败
# - 内存/CPU不足

# 解决:
# 检查任务定义中的环境变量
# 检查安全组规则
# 增加任务资源配置
```

### 问题4: ALB健康检查失败

```bash
# 检查目标组
aws elbv2 describe-target-health \
  --target-group-arn YOUR_TARGET_GROUP_ARN

# 常见原因:
# - 健康检查路径错误 (应为 /api/v1/health)
# - 端口配置错误
# - 安全组未允许ALB访问ECS

# 解决:
# 更新健康检查配置
# 检查安全组入站规则
```

---

## 📊 成本监控

部署后立即设置成本监控：

```bash
# 1. 启用Cost Explorer
aws ce get-cost-and-usage \
  --time-period Start=2026-05-01,End=2026-05-08 \
  --granularity DAILY \
  --metrics "UnblendedCost"

# 2. 设置预算告警 ($300/月)
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget file://budget.json

# 3. 每天检查Cost Explorer
# 访问: https://console.aws.amazon.com/cost-management/home
```

---

## 🔐 安全检查清单

部署后务必检查：

- [ ] RDS数据库在私有子网
- [ ] RDS密码足够强壮（至少16位）
- [ ] 安全组遵循最小权限原则
- [ ] 启用CloudTrail审计日志
- [ ] 启用GuardDuty威胁检测
- [ ] 所有数据传输使用HTTPS
- [ ] JWT密钥安全存储在Secrets Manager
- [ ] 启用MFA for root account
- [ ] 禁用root account access keys
- [ ] IAM用户使用最小权限

---

## 📚 下一步

部署完成后：

1. **设置CI/CD** - 配置GitHub Actions自动部署
   - 查看 `.github/workflows/deploy.yml`

2. **配置监控** - CloudWatch + X-Ray
   - 设置CPU/内存告警
   - 配置日志保留策略

3. **性能优化** - 数据库查询、缓存策略
   - 添加Redis缓存
   - 优化N+1查询

4. **实现核心功能** - 算命算法、AI集成
   - 八字计算引擎
   - OpenAI API集成

5. **用户测试** - Beta测试收集反馈
   - 邀请用户测试
   - 收集性能指标

---

## 🆘 获取帮助

遇到问题？

1. 查看详细文档:
   - `AWS_DEPLOYMENT_GUIDE.md` - 完整部署步骤
   - `AWS_COST_OPTIMIZATION.md` - 成本优化指南
   - `SETUP_GUIDE.md` - 本地开发设置

2. 检查AWS文档:
   - [AWS Getting Started](https://aws.amazon.com/getting-started/)
   - [ECS Documentation](https://docs.aws.amazon.com/ecs/)
   - [RDS Documentation](https://docs.aws.amazon.com/rds/)

3. 社区资源:
   - AWS Support (如果有支持计划)
   - Stack Overflow
   - AWS re:Post

---

## 🎉 恭喜！

您已成功将Fortune Teller部署到AWS！

**后端API**: http://your-alb-dns-name/api/v1
**前端应用**: http://your-s3-website-url
**Swagger文档**: http://your-alb-dns-name/api-docs

现在开始开发核心功能吧！🚀✨
