#!/bin/bash

# Fortune Teller - CloudFormation一键部署脚本
# 使用方法: ./deploy-cloudformation.sh

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置参数
STACK_NAME="fortune-teller-test"
REGION="ap-southeast-1"
PROJECT_NAME="fortune-teller"
ENVIRONMENT="test"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Fortune Teller - CloudFormation部署${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI未安装，请先安装AWS CLI${NC}"
    exit 1
fi

# 检查Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker未安装，请先安装Docker${NC}"
    exit 1
fi

# 检查AWS凭证
echo -e "${YELLOW}检查AWS凭证...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS凭证未配置，请运行: aws configure${NC}"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ AWS账号: ${ACCOUNT_ID}${NC}"
echo ""

# 输入参数
echo -e "${YELLOW}请输入部署参数:${NC}"
echo ""

read -p "Stack名称 [${STACK_NAME}]: " input_stack_name
STACK_NAME=${input_stack_name:-$STACK_NAME}

read -p "AWS Region [${REGION}]: " input_region
REGION=${input_region:-$REGION}

read -sp "数据库密码 (至少8位): " DB_PASSWORD
echo ""
if [ ${#DB_PASSWORD} -lt 8 ]; then
    echo -e "${RED}❌ 密码太短，至少需要8位${NC}"
    exit 1
fi

read -sp "JWT密钥 (至少32位): " JWT_SECRET
echo ""
if [ ${#JWT_SECRET} -lt 32 ]; then
    echo -e "${RED}❌ JWT密钥太短，至少需要32位${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}部署配置确认${NC}"
echo -e "${BLUE}========================================${NC}"
echo "Stack名称: ${STACK_NAME}"
echo "AWS Region: ${REGION}"
echo "项目名称: ${PROJECT_NAME}"
echo "环境: ${ENVIRONMENT}"
echo ""
read -p "确认部署？(y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo -e "${YELLOW}部署已取消${NC}"
    exit 0
fi

# ==========================================
# 1. 部署CloudFormation Stack
# ==========================================
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Step 1: 部署CloudFormation Stack${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查Stack是否已存在
if aws cloudformation describe-stacks --stack-name ${STACK_NAME} --region ${REGION} &> /dev/null; then
    echo -e "${YELLOW}⚠️  Stack已存在，将执行更新操作${NC}"
    ACTION="update-stack"
    WAIT_CMD="stack-update-complete"
else
    echo -e "${GREEN}创建新Stack...${NC}"
    ACTION="create-stack"
    WAIT_CMD="stack-create-complete"
fi

# 执行部署
aws cloudformation ${ACTION} \
  --stack-name ${STACK_NAME} \
  --template-body file://cloudformation-simple.yaml \
  --parameters \
    ParameterKey=ProjectName,ParameterValue=${PROJECT_NAME} \
    ParameterKey=Environment,ParameterValue=${ENVIRONMENT} \
    ParameterKey=DBPassword,ParameterValue=${DB_PASSWORD} \
    ParameterKey=JWTSecret,ParameterValue=${JWT_SECRET} \
  --capabilities CAPABILITY_IAM \
  --region ${REGION}

echo -e "${YELLOW}等待Stack部署完成（约20-25分钟）...${NC}"
echo -e "${YELLOW}您可以在AWS Console查看进度: https://console.aws.amazon.com/cloudformation${NC}"

# 等待完成
if aws cloudformation wait ${WAIT_CMD} \
  --stack-name ${STACK_NAME} \
  --region ${REGION} 2>&1 | tee /tmp/cfn-wait.log; then
    echo -e "${GREEN}✓ CloudFormation Stack部署成功！${NC}"
else
    echo -e "${RED}❌ Stack部署失败${NC}"
    echo -e "${YELLOW}查看失败原因:${NC}"
    aws cloudformation describe-stack-events \
      --stack-name ${STACK_NAME} \
      --region ${REGION} \
      --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]' \
      --output table
    exit 1
fi

# 获取输出
echo ""
echo -e "${GREEN}获取Stack输出...${NC}"
OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query 'Stacks[0].Outputs')

ECR_REPO=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="ECRRepositoryURI") | .OutputValue')
ALB_DNS=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="LoadBalancerDNS") | .OutputValue')
FRONTEND_BUCKET=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="FrontendBucketName") | .OutputValue')
FRONTEND_URL=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="FrontendURL") | .OutputValue')

echo "ECR Repository: ${ECR_REPO}"
echo "Load Balancer: ${ALB_DNS}"
echo "Frontend Bucket: ${FRONTEND_BUCKET}"

# ==========================================
# 2. 构建并推送Docker镜像
# ==========================================
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Step 2: 构建并推送Docker镜像${NC}"
echo -e "${BLUE}========================================${NC}"

read -p "是否构建并推送后端Docker镜像？(y/n): " build_backend
if [ "$build_backend" = "y" ]; then
    echo -e "${YELLOW}登录ECR...${NC}"
    aws ecr get-login-password --region ${REGION} | \
      docker login --username AWS --password-stdin ${ECR_REPO%%/*}

    echo -e "${YELLOW}构建Docker镜像...${NC}"
    cd /workspace/fortune-teller-backend
    docker build -t fortune-teller-backend:latest .

    echo -e "${YELLOW}打标签...${NC}"
    docker tag fortune-teller-backend:latest ${ECR_REPO}:latest

    echo -e "${YELLOW}推送到ECR...${NC}"
    docker push ${ECR_REPO}:latest

    echo -e "${GREEN}✓ Docker镜像推送成功！${NC}"

    # 更新ECS服务
    echo -e "${YELLOW}更新ECS服务...${NC}"
    aws ecs update-service \
      --cluster ${PROJECT_NAME}-cluster \
      --service ${PROJECT_NAME}-backend-service \
      --force-new-deployment \
      --region ${REGION} > /dev/null

    echo -e "${YELLOW}等待服务更新完成（约3-5分钟）...${NC}"
    aws ecs wait services-stable \
      --cluster ${PROJECT_NAME}-cluster \
      --services ${PROJECT_NAME}-backend-service \
      --region ${REGION}

    echo -e "${GREEN}✓ 后端服务部署成功！${NC}"
else
    echo -e "${YELLOW}跳过后端构建${NC}"
fi

# ==========================================
# 3. 部署前端
# ==========================================
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Step 3: 部署前端${NC}"
echo -e "${BLUE}========================================${NC}"

read -p "是否构建并部署前端？(y/n): " build_frontend
if [ "$build_frontend" = "y" ]; then
    cd /workspace/fortune-teller-frontend

    echo -e "${YELLOW}配置环境变量...${NC}"
    cat > .env.production <<EOF
VITE_API_BASE_URL=http://${ALB_DNS}/api/v1
VITE_APP_NAME=Fortune Teller
EOF

    echo -e "${YELLOW}安装依赖...${NC}"
    npm install

    echo -e "${YELLOW}构建前端...${NC}"
    npm run build

    echo -e "${YELLOW}上传到S3...${NC}"
    aws s3 sync dist/ s3://${FRONTEND_BUCKET}/ --delete --region ${REGION}

    echo -e "${GREEN}✓ 前端部署成功！${NC}"
else
    echo -e "${YELLOW}跳过前端构建${NC}"
fi

# ==========================================
# 4. 验证部署
# ==========================================
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Step 4: 验证部署${NC}"
echo -e "${BLUE}========================================${NC}"

echo -e "${YELLOW}测试后端健康检查...${NC}"
sleep 5  # 等待服务启动

if curl -f -s http://${ALB_DNS}/api/v1/health > /dev/null; then
    echo -e "${GREEN}✓ 后端健康检查通过${NC}"
else
    echo -e "${RED}❌ 后端健康检查失败${NC}"
    echo -e "${YELLOW}请检查ECS任务日志：${NC}"
    echo "aws logs tail /ecs/${PROJECT_NAME}-backend --follow --region ${REGION}"
fi

# ==========================================
# 完成
# ==========================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}访问地址：${NC}"
echo -e "  📱 前端: ${GREEN}${FRONTEND_URL}${NC}"
echo -e "  🔧 后端API: ${GREEN}http://${ALB_DNS}/api/v1${NC}"
echo -e "  📊 API文档: ${GREEN}http://${ALB_DNS}/api-docs${NC}"
echo -e "  💚 健康检查: ${GREEN}http://${ALB_DNS}/api/v1/health${NC}"
echo ""
echo -e "${BLUE}管理命令：${NC}"
echo -e "  查看日志: ${YELLOW}aws logs tail /ecs/${PROJECT_NAME}-backend --follow --region ${REGION}${NC}"
echo -e "  查看ECS: ${YELLOW}aws ecs describe-services --cluster ${PROJECT_NAME}-cluster --services ${PROJECT_NAME}-backend-service --region ${REGION}${NC}"
echo -e "  删除Stack: ${YELLOW}./delete-stack.sh${NC}"
echo ""
echo -e "${BLUE}下一步：${NC}"
echo "  1. 访问前端URL测试应用"
echo "  2. 运行数据库迁移"
echo "  3. 实现核心算命功能"
echo "  4. 配置CI/CD自动部署"
echo ""
echo -e "${GREEN}祝开发顺利！🚀${NC}"
