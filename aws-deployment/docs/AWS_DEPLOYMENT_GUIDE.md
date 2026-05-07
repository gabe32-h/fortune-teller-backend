# Fortune Teller - AWS完整部署指南

## 📋 前置准备

### 1. AWS账号设置
- [ ] 创建AWS账号
- [ ] 启用MFA (多因素认证)
- [ ] 创建IAM用户 (不使用root账号)
- [ ] 安装AWS CLI

### 2. 本地工具安装
```bash
# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# 配置AWS凭证
aws configure
# AWS Access Key ID: 输入您的Key
# AWS Secret Access Key: 输入您的Secret
# Default region: ap-southeast-1
# Default output format: json

# Docker (用于构建容器镜像)
sudo apt-get update
sudo apt-get install docker.io
sudo usermod -aG docker $USER

# Terraform (可选，用于基础设施即代码)
wget https://releases.hashicorp.com/terraform/1.7.0/terraform_1.7.0_linux_amd64.zip
unzip terraform_1.7.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

---

## 🏗️ 第一阶段：基础设施搭建

### Step 1: 创建VPC和网络

```bash
# 1.1 创建VPC
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=fortune-teller-vpc}]'
# 记录VPC ID: vpc-xxxxx

# 1.2 创建Internet Gateway
aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=fortune-teller-igw}]'
# 记录IGW ID: igw-xxxxx

# 1.3 附加IGW到VPC
aws ec2 attach-internet-gateway \
  --vpc-id vpc-xxxxx \
  --internet-gateway-id igw-xxxxx

# 1.4 创建公共子网 (ALB使用)
aws ec2 create-subnet \
  --vpc-id vpc-xxxxx \
  --cidr-block 10.0.1.0/24 \
  --availability-zone ap-southeast-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=public-subnet-1a}]'

aws ec2 create-subnet \
  --vpc-id vpc-xxxxx \
  --cidr-block 10.0.2.0/24 \
  --availability-zone ap-southeast-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=public-subnet-1b}]'

# 1.5 创建私有子网 (ECS使用)
aws ec2 create-subnet \
  --vpc-id vpc-xxxxx \
  --cidr-block 10.0.10.0/24 \
  --availability-zone ap-southeast-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=private-app-subnet-1a}]'

aws ec2 create-subnet \
  --vpc-id vpc-xxxxx \
  --cidr-block 10.0.11.0/24 \
  --availability-zone ap-southeast-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=private-app-subnet-1b}]'

# 1.6 创建数据库子网
aws ec2 create-subnet \
  --vpc-id vpc-xxxxx \
  --cidr-block 10.0.20.0/24 \
  --availability-zone ap-southeast-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=private-data-subnet-1a}]'

aws ec2 create-subnet \
  --vpc-id vpc-xxxxx \
  --cidr-block 10.0.21.0/24 \
  --availability-zone ap-southeast-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=private-data-subnet-1b}]'

# 1.7 创建NAT Gateway (用于私有子网访问外网)
# 先分配Elastic IP
aws ec2 allocate-address --domain vpc
# 记录 AllocationId: eipalloc-xxxxx

# 创建NAT Gateway在公共子网
aws ec2 create-nat-gateway \
  --subnet-id subnet-xxxxx \
  --allocation-id eipalloc-xxxxx \
  --tag-specifications 'ResourceType=natgateway,Tags=[{Key=Name,Value=fortune-teller-nat}]'

# 1.8 配置路由表
# 公共路由表
aws ec2 create-route-table --vpc-id vpc-xxxxx
aws ec2 create-route \
  --route-table-id rtb-xxxxx \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id igw-xxxxx

# 私有路由表
aws ec2 create-route-table --vpc-id vpc-xxxxx
aws ec2 create-route \
  --route-table-id rtb-yyyyy \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id nat-xxxxx
```

### Step 2: 创建安全组

```bash
# 2.1 ALB安全组
aws ec2 create-security-group \
  --group-name fortune-teller-alb-sg \
  --description "Security group for ALB" \
  --vpc-id vpc-xxxxx

# 允许HTTP/HTTPS入站
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

# 2.2 ECS安全组
aws ec2 create-security-group \
  --group-name fortune-teller-ecs-sg \
  --description "Security group for ECS tasks" \
  --vpc-id vpc-xxxxx

# 只允许来自ALB的流量
aws ec2 authorize-security-group-ingress \
  --group-id sg-yyyyy \
  --protocol tcp \
  --port 3000 \
  --source-group sg-xxxxx

# 允许访问外部HTTPS (OpenAI API等)
aws ec2 authorize-security-group-egress \
  --group-id sg-yyyyy \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# 2.3 RDS安全组
aws ec2 create-security-group \
  --group-name fortune-teller-rds-sg \
  --description "Security group for RDS" \
  --vpc-id vpc-xxxxx

aws ec2 authorize-security-group-ingress \
  --group-id sg-zzzzz \
  --protocol tcp \
  --port 5432 \
  --source-group sg-yyyyy

# 2.4 Redis安全组
aws ec2 create-security-group \
  --group-name fortune-teller-redis-sg \
  --description "Security group for Redis" \
  --vpc-id vpc-xxxxx

aws ec2 authorize-security-group-ingress \
  --group-id sg-wwwww \
  --protocol tcp \
  --port 6379 \
  --source-group sg-yyyyy
```

---

## 🗄️ 第二阶段：数据层部署

### Step 3: 创建RDS PostgreSQL数据库

```bash
# 3.1 创建数据库子网组
aws rds create-db-subnet-group \
  --db-subnet-group-name fortune-teller-db-subnet-group \
  --db-subnet-group-description "Subnet group for Fortune Teller DB" \
  --subnet-ids subnet-data-1a subnet-data-1b

# 3.2 创建RDS实例
aws rds create-db-instance \
  --db-instance-identifier fortune-teller-db \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --engine-version 15.4 \
  --master-username postgres \
  --master-user-password "YourStrongPassword123!" \
  --allocated-storage 20 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-zzzzz \
  --db-subnet-group-name fortune-teller-db-subnet-group \
  --multi-az \
  --publicly-accessible false \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "sun:04:00-sun:05:00" \
  --enable-cloudwatch-logs-exports '["postgresql"]' \
  --storage-encrypted

# 等待数据库创建完成 (约10分钟)
aws rds wait db-instance-available --db-instance-identifier fortune-teller-db

# 获取数据库端点
aws rds describe-db-instances \
  --db-instance-identifier fortune-teller-db \
  --query 'DBInstances[0].Endpoint.Address'
# 记录: fortune-teller-db.xxxxx.ap-southeast-1.rds.amazonaws.com
```

### Step 4: 创建ElastiCache Redis

```bash
# 4.1 创建Redis子网组
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name fortune-teller-redis-subnet-group \
  --cache-subnet-group-description "Subnet group for Redis" \
  --subnet-ids subnet-data-1a subnet-data-1b

# 4.2 创建Redis集群
aws elasticache create-cache-cluster \
  --cache-cluster-id fortune-teller-redis \
  --cache-node-type cache.t4g.micro \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-nodes 1 \
  --cache-subnet-group-name fortune-teller-redis-subnet-group \
  --security-group-ids sg-wwwww \
  --preferred-maintenance-window "sun:05:00-sun:06:00"

# 等待Redis创建完成
aws elasticache wait cache-cluster-available \
  --cache-cluster-id fortune-teller-redis

# 获取Redis端点
aws elasticache describe-cache-clusters \
  --cache-cluster-id fortune-teller-redis \
  --show-cache-node-info \
  --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address'
# 记录: fortune-teller-redis.xxxxx.0001.apse1.cache.amazonaws.com
```

### Step 5: 存储密钥到Secrets Manager

```bash
# 5.1 存储数据库密码
aws secretsmanager create-secret \
  --name fortune-teller/database \
  --description "Database credentials" \
  --secret-string '{
    "username": "postgres",
    "password": "YourStrongPassword123!",
    "host": "fortune-teller-db.xxxxx.ap-southeast-1.rds.amazonaws.com",
    "port": 5432,
    "database": "fortune_teller"
  }'

# 5.2 存储JWT密钥
aws secretsmanager create-secret \
  --name fortune-teller/jwt \
  --description "JWT secrets" \
  --secret-string '{
    "JWT_SECRET": "your-super-secret-jwt-key-change-this",
    "JWT_REFRESH_SECRET": "your-super-secret-refresh-key-change-this"
  }'

# 5.3 存储OpenAI API Key (如果使用)
aws secretsmanager create-secret \
  --name fortune-teller/openai \
  --description "OpenAI API Key" \
  --secret-string '{
    "OPENAI_API_KEY": "sk-your-openai-api-key"
  }'
```

---

## 📦 第三阶段：容器化和ECR

### Step 6: 创建Dockerfile (Backend)

在 `/workspace/fortune-teller-backend/` 创建 `Dockerfile`:

```dockerfile
# 多阶段构建
FROM node:20-alpine AS builder

WORKDIR /app

# 复制package文件
COPY package*.json ./
COPY tsconfig.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY src ./src
COPY prisma ./prisma

# 生成Prisma客户端
RUN npx prisma generate

# 构建TypeScript
RUN npm run build

# 生产阶段
FROM node:20-alpine

WORKDIR /app

# 只安装生产依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用
CMD ["npm", "start"]
```

创建 `.dockerignore`:

```
node_modules
dist
.env
.git
.gitignore
README.md
npm-debug.log
```

### Step 7: 推送镜像到ECR

```bash
# 7.1 创建ECR仓库
aws ecr create-repository \
  --repository-name fortune-teller/backend \
  --image-scanning-configuration scanOnPush=true

# 记录仓库URI: 123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/fortune-teller/backend

# 7.2 登录ECR
aws ecr get-login-password --region ap-southeast-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.ap-southeast-1.amazonaws.com

# 7.3 构建Docker镜像
cd /workspace/fortune-teller-backend
docker build -t fortune-teller/backend:latest .

# 7.4 打标签
docker tag fortune-teller/backend:latest \
  123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/fortune-teller/backend:latest

# 7.5 推送到ECR
docker push 123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/fortune-teller/backend:latest
```

---

## 🚢 第四阶段：ECS部署

### Step 8: 创建ECS集群

```bash
# 8.1 创建ECS集群
aws ecs create-cluster \
  --cluster-name fortune-teller-cluster \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy \
    capacityProvider=FARGATE,weight=1 \
    capacityProvider=FARGATE_SPOT,weight=1
```

### Step 9: 创建任务定义

创建文件 `task-definition.json`:

```json
{
  "family": "fortune-teller-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/fortune-teller/backend:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:fortune-teller/database:host::"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:fortune-teller/jwt:JWT_SECRET::"
        },
        {
          "name": "REDIS_HOST",
          "valueFrom": "arn:aws:secretsmanager:ap-southeast-1:123456789012:secret:fortune-teller/redis:host::"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/fortune-teller-backend",
          "awslogs-region": "ap-southeast-1",
          "awslogs-stream-prefix": "backend"
        }
      },
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "curl -f http://localhost:3000/api/v1/health || exit 1"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

注册任务定义:

```bash
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json
```

### Step 10: 创建Application Load Balancer

```bash
# 10.1 创建ALB
aws elbv2 create-load-balancer \
  --name fortune-teller-alb \
  --subnets subnet-public-1a subnet-public-1b \
  --security-groups sg-alb \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4

# 记录 LoadBalancerArn 和 DNSName

# 10.2 创建目标组
aws elbv2 create-target-group \
  --name fortune-teller-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-xxxxx \
  --target-type ip \
  --health-check-enabled \
  --health-check-path /api/v1/health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3

# 记录 TargetGroupArn

# 10.3 创建监听器 (先HTTP，后面添加HTTPS)
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...
```

### Step 11: 创建ECS服务

```bash
aws ecs create-service \
  --cluster fortune-teller-cluster \
  --service-name fortune-teller-backend-service \
  --task-definition fortune-teller-backend:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-private-app-1a,subnet-private-app-1b],securityGroups=[sg-ecs],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=backend,containerPort=3000" \
  --health-check-grace-period-seconds 60 \
  --deployment-configuration "maximumPercent=200,minimumHealthyPercent=50,deploymentCircuitBreaker={enable=true,rollback=true}"
```

---

## 🌐 第五阶段：前端部署

### Step 12: 创建S3存储桶

```bash
# 12.1 创建S3存储桶 (前端静态文件)
aws s3 mb s3://fortune-teller-frontend-prod --region ap-southeast-1

# 12.2 启用静态网站托管
aws s3 website s3://fortune-teller-frontend-prod \
  --index-document index.html \
  --error-document index.html

# 12.3 配置存储桶策略 (允许CloudFront访问)
cat > bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAI",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity xxxxx"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::fortune-teller-frontend-prod/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket fortune-teller-frontend-prod \
  --policy file://bucket-policy.json

# 12.4 创建S3存储桶 (PDF报告)
aws s3 mb s3://fortune-teller-reports-prod --region ap-southeast-1

# 启用加密
aws s3api put-bucket-encryption \
  --bucket fortune-teller-reports-prod \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# 配置生命周期策略 (30天后转到IA，90天后删除)
aws s3api put-bucket-lifecycle-configuration \
  --bucket fortune-teller-reports-prod \
  --lifecycle-configuration '{
    "Rules": [{
      "Id": "archive-old-reports",
      "Status": "Enabled",
      "Transitions": [{
        "Days": 30,
        "StorageClass": "STANDARD_IA"
      }],
      "Expiration": {
        "Days": 90
      }
    }]
  }'
```

### Step 13: 配置CloudFront

```bash
# 13.1 创建Origin Access Identity
aws cloudfront create-cloud-front-origin-access-identity \
  --cloud-front-origin-access-identity-config \
  CallerReference=fortune-teller-$(date +%s),Comment="OAI for Fortune Teller"

# 13.2 创建CloudFront分发 (distribution-config.json)
# 这个配置比较复杂，建议通过AWS Console操作或使用Terraform

# 关键配置:
# - Origin: S3存储桶 (fortune-teller-frontend-prod)
# - Origin: ALB (fortune-teller-alb-xxxxx.ap-southeast-1.elb.amazonaws.com)
# - Behavior: /* → S3
# - Behavior: /api/* → ALB
# - Price Class: 包含亚洲边缘节点
# - SSL Certificate: 使用ACM证书
```

### Step 14: 构建和部署前端

```bash
# 14.1 更新前端环境变量
cd /workspace/fortune-teller-frontend
cat > .env.production <<EOF
VITE_API_BASE_URL=https://your-domain.com/api/v1
VITE_APP_NAME=Fortune Teller
EOF

# 14.2 构建前端
npm run build

# 14.3 上传到S3
aws s3 sync dist/ s3://fortune-teller-frontend-prod/ \
  --delete \
  --cache-control "public, max-age=31536000" \
  --exclude "index.html"

# index.html 不缓存
aws s3 cp dist/index.html s3://fortune-teller-frontend-prod/index.html \
  --cache-control "no-cache, no-store, must-revalidate"

# 14.4 使CloudFront缓存失效
aws cloudfront create-invalidation \
  --distribution-id E123456789ABCD \
  --paths "/*"
```

---

## 🔐 第六阶段：SSL证书和域名

### Step 15: 配置域名和SSL

```bash
# 15.1 在ACM申请SSL证书
aws acm request-certificate \
  --domain-name your-domain.com \
  --subject-alternative-names *.your-domain.com \
  --validation-method DNS \
  --region us-east-1  # CloudFront证书必须在us-east-1

# 15.2 验证域名所有权
# 在您的DNS提供商添加CNAME记录
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:123456789012:certificate/xxxxx

# 15.3 等待证书验证通过
aws acm wait certificate-validated \
  --certificate-arn arn:aws:acm:us-east-1:123456789012:certificate/xxxxx

# 15.4 将证书关联到CloudFront
# 通过Console或更新CloudFront配置

# 15.5 配置Route 53 (如果使用)
# 创建A记录指向CloudFront分发
```

---

## 📊 第七阶段：监控和日志

### Step 16: 配置CloudWatch

```bash
# 16.1 创建日志组
aws logs create-log-group \
  --log-group-name /ecs/fortune-teller-backend

# 16.2 创建CloudWatch告警
# CPU使用率告警
aws cloudwatch put-metric-alarm \
  --alarm-name fortune-teller-cpu-high \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=ClusterName,Value=fortune-teller-cluster Name=ServiceName,Value=fortune-teller-backend-service

# 内存使用率告警
aws cloudwatch put-metric-alarm \
  --alarm-name fortune-teller-memory-high \
  --alarm-description "Alert when memory exceeds 80%" \
  --metric-name MemoryUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# 16.3 创建Dashboard
aws cloudwatch put-dashboard \
  --dashboard-name fortune-teller-dashboard \
  --dashboard-body file://dashboard-config.json
```

### Step 17: 启用X-Ray追踪

```bash
# 在任务定义中添加X-Ray守护进程容器
# 参考AWS文档配置
```

---

## 💾 第八阶段：备份和灾难恢复

### Step 18: 配置AWS Backup

```bash
# 18.1 创建备份保管库
aws backup create-backup-vault \
  --backup-vault-name fortune-teller-vault

# 18.2 创建备份计划
aws backup create-backup-plan \
  --backup-plan '{
    "BackupPlanName": "fortune-teller-daily-backup",
    "Rules": [{
      "RuleName": "daily-backup",
      "TargetBackupVaultName": "fortune-teller-vault",
      "ScheduleExpression": "cron(0 3 * * ? *)",
      "StartWindowMinutes": 60,
      "CompletionWindowMinutes": 120,
      "Lifecycle": {
        "DeleteAfterDays": 30
      }
    }]
  }'

# 18.3 选择要备份的资源
# RDS自动备份已在创建时启用
# 可以添加标签自动选择资源备份
```

---

## 🎯 部署验证清单

完成所有步骤后，验证：

- [ ] VPC和子网正确配置
- [ ] 安全组规则正确
- [ ] RDS数据库可访问
- [ ] Redis缓存可用
- [ ] ECS任务运行正常
- [ ] ALB健康检查通过
- [ ] 前端静态文件可访问
- [ ] CloudFront分发正常
- [ ] SSL证书有效
- [ ] 域名解析正确
- [ ] API端点响应正常
- [ ] 数据库连接成功
- [ ] Redis连接成功
- [ ] 日志正常输出到CloudWatch
- [ ] 监控告警配置正确
- [ ] 备份计划启用

---

## 🔄 滚动更新流程

部署新版本:

```bash
# 1. 构建新镜像
docker build -t fortune-teller/backend:v1.1.0 .

# 2. 推送到ECR
docker tag fortune-teller/backend:v1.1.0 \
  123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/fortune-teller/backend:v1.1.0
docker push 123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/fortune-teller/backend:v1.1.0

# 3. 更新任务定义
# 修改task-definition.json中的镜像标签
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json

# 4. 更新服务
aws ecs update-service \
  --cluster fortune-teller-cluster \
  --service fortune-teller-backend-service \
  --task-definition fortune-teller-backend:2 \
  --force-new-deployment

# 5. 监控部署
aws ecs describe-services \
  --cluster fortune-teller-cluster \
  --services fortune-teller-backend-service \
  --query 'services[0].deployments'
```

---

## 🚨 故障排查

### 常见问题

1. **ECS任务无法启动**
   - 检查任务日志: CloudWatch Logs
   - 检查安全组规则
   - 检查Secrets Manager权限

2. **ALB健康检查失败**
   - 检查健康检查路径: /api/v1/health
   - 检查容器端口映射
   - 检查安全组入站规则

3. **数据库连接失败**
   - 检查RDS安全组
   - 检查数据库凭证
   - 检查VPC网络配置

4. **前端无法访问后端**
   - 检查CORS配置
   - 检查CloudFront行为配置
   - 检查API Gateway路由

---

## 📞 获取帮助

- AWS Support
- AWS Documentation
- Stack Overflow
- GitHub Issues

恭喜！您的Fortune Teller应用已成功部署到AWS！🎉
