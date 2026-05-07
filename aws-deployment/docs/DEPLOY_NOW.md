# 🚀 立即部署 - 复制粘贴命令

## 方案选择

您有两种方式部署：

---

## 方式1：在您的本地电脑运行（推荐）⭐

### 前提条件
- 已安装AWS CLI
- 已配置AWS凭证（`aws configure`）
- 已安装Docker

### 部署步骤

#### Step 1: 下载CloudFormation模板到本地

```bash
# 从GitHub下载或直接复制 /workspace/cloudformation-simple.yaml 文件
# 保存到本地，例如：~/fortune-teller/cloudformation-simple.yaml
```

#### Step 2: 部署CloudFormation Stack

```bash
# 设置参数
export STACK_NAME="fortune-teller-test"
export REGION="ap-southeast-1"
export DB_PASSWORD="YourStrongPassword123!"  # 修改这个
export JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters-long"  # 修改这个

# 创建Stack
aws cloudformation create-stack \
  --stack-name ${STACK_NAME} \
  --template-body file://cloudformation-simple.yaml \
  --parameters \
    ParameterKey=ProjectName,ParameterValue=fortune-teller \
    ParameterKey=Environment,ParameterValue=test \
    ParameterKey=DBPassword,ParameterValue=${DB_PASSWORD} \
    ParameterKey=JWTSecret,ParameterValue=${JWT_SECRET} \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

echo "✅ Stack创建已启动！"
echo "在AWS Console查看进度: https://console.aws.amazon.com/cloudformation"
echo "预计需要20-25分钟..."
```

#### Step 3: 等待Stack完成

```bash
# 等待创建完成
aws cloudformation wait stack-create-complete \
  --stack-name ${STACK_NAME} \
  --region ${REGION}

echo "✅ Stack创建完成！"
```

#### Step 4: 获取输出信息

```bash
# 获取所有输出
aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query 'Stacks[0].Outputs' \
  --output table

# 保存到变量
export ECR_REPO=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryURI`].OutputValue' \
  --output text)

export ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text)

export FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)

echo "ECR Repository: ${ECR_REPO}"
echo "Load Balancer: ${ALB_DNS}"
echo "Frontend Bucket: ${FRONTEND_BUCKET}"
```

#### Step 5: 构建并推送Docker镜像

```bash
# 克隆后端代码到本地（如果还没有）
git clone https://github.com/gabe32-h/fortune-teller-backend.git
cd fortune-teller-backend

# 登录ECR
aws ecr get-login-password --region ${REGION} | \
  docker login --username AWS --password-stdin ${ECR_REPO%%/*}

# 构建镜像
docker build -t fortune-teller-backend:latest .

# 打标签
docker tag fortune-teller-backend:latest ${ECR_REPO}:latest

# 推送到ECR
docker push ${ECR_REPO}:latest

echo "✅ Docker镜像已推送！"
```

#### Step 6: 更新ECS服务

```bash
# 强制更新ECS服务，拉取新镜像
aws ecs update-service \
  --cluster fortune-teller-cluster \
  --service fortune-teller-backend-service \
  --force-new-deployment \
  --region ${REGION}

echo "⏳ 等待服务更新完成（约3-5分钟）..."

# 等待服务稳定
aws ecs wait services-stable \
  --cluster fortune-teller-cluster \
  --services fortune-teller-backend-service \
  --region ${REGION}

echo "✅ 后端服务已部署！"
```

#### Step 7: 部署前端

```bash
# 克隆前端代码到本地（如果还没有）
git clone https://github.com/gabe32-h/fortune-teller-frontend.git
cd fortune-teller-frontend

# 配置环境变量
cat > .env.production <<EOF
VITE_API_BASE_URL=http://${ALB_DNS}/api/v1
VITE_APP_NAME=Fortune Teller
EOF

# 安装依赖
npm install

# 构建
npm run build

# 上传到S3
aws s3 sync dist/ s3://${FRONTEND_BUCKET}/ --delete --region ${REGION}

echo "✅ 前端已部署！"
```

#### Step 8: 验证部署

```bash
# 测试后端
curl http://${ALB_DNS}/api/v1/health

# 获取前端URL
export FRONTEND_URL=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendURL`].OutputValue' \
  --output text)

echo "🎉 部署完成！"
echo ""
echo "📱 前端: ${FRONTEND_URL}"
echo "🔧 后端: http://${ALB_DNS}/api/v1"
echo "📊 API文档: http://${ALB_DNS}/api-docs"
```

---

## 方式2：通过AWS Console部署（最简单）

### Step 1: 上传模板

1. 访问 AWS Console: https://console.aws.amazon.com/cloudformation/
2. 点击 **"Create stack"** → **"With new resources"**
3. 选择 **"Upload a template file"**
4. 上传 `/workspace/cloudformation-simple.yaml`
5. 点击 **"Next"**

### Step 2: 配置参数

填写以下参数：
- **Stack name**: `fortune-teller-test`
- **ProjectName**: `fortune-teller` (保持默认)
- **Environment**: `test` (保持默认)
- **DBPassword**: 输入强密码（至少8位，例如：`MyPassword123!`）
- **JWTSecret**: 输入JWT密钥（至少32位，例如：`my-super-secret-jwt-key-for-testing-32chars`）

点击 **"Next"**

### Step 3: 配置选项

- 保持默认设置
- 点击 **"Next"**

### Step 4: 审查并创建

1. 勾选 **"I acknowledge that AWS CloudFormation might create IAM resources"**
2. 点击 **"Create stack"**
3. 等待20-25分钟完成

### Step 5: 查看输出

1. Stack状态变为 `CREATE_COMPLETE` 后
2. 点击 **"Outputs"** 标签页
3. 记录以下信息：
   - `ECRRepositoryURI` - Docker镜像仓库
   - `LoadBalancerDNS` - 后端API地址
   - `FrontendBucketName` - 前端S3桶
   - `FrontendURL` - 前端访问地址

### Step 6-8: 构建和部署代码

参考方式1的Step 5-8，在本地构建并推送Docker镜像和前端代码。

---

## 方式3：一键命令（最快）

如果您的本地环境已配置好AWS CLI和Docker：

```bash
# 创建一个临时脚本
cat > /tmp/deploy-fortune-teller.sh <<'EOF'
#!/bin/bash
set -e

# 参数
STACK_NAME="fortune-teller-test"
REGION="ap-southeast-1"

# 请修改这两个密码！
DB_PASSWORD="YourStrongPassword123!"
JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters-long"

echo "🚀 开始部署Fortune Teller..."

# 1. 部署CloudFormation
echo "📦 创建CloudFormation Stack..."
aws cloudformation create-stack \
  --stack-name ${STACK_NAME} \
  --template-body file://cloudformation-simple.yaml \
  --parameters \
    ParameterKey=DBPassword,ParameterValue=${DB_PASSWORD} \
    ParameterKey=JWTSecret,ParameterValue=${JWT_SECRET} \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

echo "⏳ 等待Stack创建完成（约20-25分钟）..."
aws cloudformation wait stack-create-complete \
  --stack-name ${STACK_NAME} \
  --region ${REGION}

# 2. 获取输出
ECR_REPO=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query 'Stacks[0].Outputs[?OutputKey==`ECRRepositoryURI`].OutputValue' \
  --output text)

ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text)

FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)

# 3. 构建后端
echo "🔧 构建并推送后端Docker镜像..."
cd fortune-teller-backend
aws ecr get-login-password --region ${REGION} | \
  docker login --username AWS --password-stdin ${ECR_REPO%%/*}
docker build -t backend:latest .
docker tag backend:latest ${ECR_REPO}:latest
docker push ${ECR_REPO}:latest

# 4. 更新ECS
echo "🔄 更新ECS服务..."
aws ecs update-service \
  --cluster fortune-teller-cluster \
  --service fortune-teller-backend-service \
  --force-new-deployment \
  --region ${REGION}

aws ecs wait services-stable \
  --cluster fortune-teller-cluster \
  --services fortune-teller-backend-service \
  --region ${REGION}

# 5. 部署前端
echo "📱 部署前端..."
cd ../fortune-teller-frontend
cat > .env.production <<EOL
VITE_API_BASE_URL=http://${ALB_DNS}/api/v1
VITE_APP_NAME=Fortune Teller
EOL
npm install && npm run build
aws s3 sync dist/ s3://${FRONTEND_BUCKET}/ --delete --region ${REGION}

# 完成
echo ""
echo "🎉 部署完成！"
echo ""
echo "📱 前端: http://${FRONTEND_BUCKET}.s3-website-${REGION}.amazonaws.com"
echo "🔧 后端: http://${ALB_DNS}/api/v1"
echo "💚 健康检查: http://${ALB_DNS}/api/v1/health"
EOF

chmod +x /tmp/deploy-fortune-teller.sh

# 运行脚本
/tmp/deploy-fortune-teller.sh
```

---

## 🔍 监控部署进度

### 查看CloudFormation进度

```bash
# 查看Stack事件
aws cloudformation describe-stack-events \
  --stack-name fortune-teller-test \
  --max-items 20 \
  --region ap-southeast-1

# 或在Console查看
# https://console.aws.amazon.com/cloudformation/
```

### 查看ECS服务状态

```bash
# 查看ECS服务
aws ecs describe-services \
  --cluster fortune-teller-cluster \
  --services fortune-teller-backend-service \
  --region ap-southeast-1

# 查看任务
aws ecs list-tasks \
  --cluster fortune-teller-cluster \
  --service-name fortune-teller-backend-service \
  --region ap-southeast-1
```

### 查看日志

```bash
# 实时查看后端日志
aws logs tail /ecs/fortune-teller-backend --follow --region ap-southeast-1
```

---

## ❌ 删除所有资源

```bash
export STACK_NAME="fortune-teller-test"
export REGION="ap-southeast-1"

# 获取存储桶名称
FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)

REPORTS_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query 'Stacks[0].Outputs[?OutputKey==`ReportsBucketName`].OutputValue' \
  --output text)

# 清空S3
aws s3 rm s3://${FRONTEND_BUCKET} --recursive --region ${REGION}
aws s3 rm s3://${REPORTS_BUCKET} --recursive --region ${REGION}

# 删除ECR镜像
aws ecr batch-delete-image \
  --repository-name fortune-teller/backend \
  --image-ids imageTag=latest \
  --region ${REGION}

# 删除Stack
aws cloudformation delete-stack \
  --stack-name ${STACK_NAME} \
  --region ${REGION}

# 等待删除完成
aws cloudformation wait stack-delete-complete \
  --stack-name ${STACK_NAME} \
  --region ${REGION}

echo "✅ 所有资源已删除！"
```

---

## 💡 提示

1. **确保修改密码**：不要使用示例中的默认密码！
2. **选择正确的Region**：如果不在新加坡，修改`REGION`变量
3. **检查AWS凭证**：运行 `aws sts get-caller-identity` 确认配置正确
4. **监控成本**：设置账单告警，避免意外费用
5. **测试环境**：这是测试配置，生产环境需要Multi-AZ和更多优化

---

## 🆘 遇到问题？

### AWS CLI未安装
```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# 配置
aws configure
```

### Docker未安装
```bash
# macOS
brew install docker

# Linux
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### Stack创建失败
```bash
# 查看失败原因
aws cloudformation describe-stack-events \
  --stack-name fortune-teller-test \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]' \
  --output table
```

---

## 🎯 推荐方案

**对于首次部署：**
- 推荐使用 **方式2（AWS Console）** - 最直观，易于监控
- 部署完成后，使用 **方式1的Step 5-8** 构建和推送代码

**对于经常部署：**
- 推荐使用 **方式3（一键脚本）** - 最快速，全自动

**无论哪种方式，大约30-40分钟即可完成完整部署！** 🚀

祝部署顺利！如有问题随时告诉我！😊
