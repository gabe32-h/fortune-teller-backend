#!/bin/bash

# Fortune Teller - 删除CloudFormation Stack脚本
# 使用方法: ./delete-stack.sh

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
STACK_NAME="fortune-teller-test"
REGION="ap-southeast-1"
PROJECT_NAME="fortune-teller"

echo -e "${RED}========================================${NC}"
echo -e "${RED}⚠️  删除CloudFormation Stack${NC}"
echo -e "${RED}========================================${NC}"
echo ""
echo -e "${YELLOW}警告：此操作将删除所有资源和数据！${NC}"
echo ""
echo "Stack名称: ${STACK_NAME}"
echo "AWS Region: ${REGION}"
echo ""
read -p "确认删除？(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${GREEN}操作已取消${NC}"
    exit 0
fi

# 再次确认
echo ""
echo -e "${RED}⚠️  最后确认：所有数据将永久删除！${NC}"
read -p "输入 'DELETE' 确认删除: " final_confirm

if [ "$final_confirm" != "DELETE" ]; then
    echo -e "${GREEN}操作已取消${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}开始删除资源...${NC}"

# 获取Stack输出
echo -e "${YELLOW}获取Stack信息...${NC}"
OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --region ${REGION} \
  --query 'Stacks[0].Outputs' 2>/dev/null || echo "[]")

FRONTEND_BUCKET=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="FrontendBucketName") | .OutputValue' 2>/dev/null || echo "")
REPORTS_BUCKET=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="ReportsBucketName") | .OutputValue' 2>/dev/null || echo "")

# 1. 清空S3存储桶
if [ -n "$FRONTEND_BUCKET" ]; then
    echo -e "${YELLOW}清空前端S3存储桶...${NC}"
    aws s3 rm s3://${FRONTEND_BUCKET} --recursive --region ${REGION} 2>/dev/null || true
    echo -e "${GREEN}✓ 前端存储桶已清空${NC}"
fi

if [ -n "$REPORTS_BUCKET" ]; then
    echo -e "${YELLOW}清空报告S3存储桶...${NC}"
    aws s3 rm s3://${REPORTS_BUCKET} --recursive --region ${REGION} 2>/dev/null || true
    echo -e "${GREEN}✓ 报告存储桶已清空${NC}"
fi

# 2. 删除ECR镜像
echo -e "${YELLOW}删除ECR镜像...${NC}"
aws ecr batch-delete-image \
  --repository-name ${PROJECT_NAME}/backend \
  --image-ids imageTag=latest \
  --region ${REGION} 2>/dev/null || true
echo -e "${GREEN}✓ ECR镜像已删除${NC}"

# 3. 删除CloudFormation Stack
echo -e "${YELLOW}删除CloudFormation Stack...${NC}"
aws cloudformation delete-stack \
  --stack-name ${STACK_NAME} \
  --region ${REGION}

echo -e "${YELLOW}等待Stack删除完成（约10-15分钟）...${NC}"
echo -e "${YELLOW}您可以在AWS Console查看进度: https://console.aws.amazon.com/cloudformation${NC}"

# 等待删除完成
if aws cloudformation wait stack-delete-complete \
  --stack-name ${STACK_NAME} \
  --region ${REGION} 2>&1; then
    echo -e "${GREEN}✓ Stack删除成功！${NC}"
else
    echo -e "${RED}❌ Stack删除失败或超时${NC}"
    echo -e "${YELLOW}请在AWS Console手动检查并删除残留资源${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ 所有资源已删除${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}已删除的资源：${NC}"
echo "  - VPC和网络配置"
echo "  - ECS集群和任务"
echo "  - RDS PostgreSQL数据库"
echo "  - ElastiCache Redis"
echo "  - Application Load Balancer"
echo "  - S3存储桶"
echo "  - ECR镜像仓库"
echo "  - IAM角色"
echo "  - CloudWatch日志"
echo ""
echo -e "${GREEN}清理完成！${NC}"
