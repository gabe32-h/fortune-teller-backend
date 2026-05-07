# GitHub Actions CI/CD Workflows

本目录包含GitHub Actions自动化CI/CD配置文件。

## ⚠️ 重要说明

由于GitHub的安全限制，workflow文件需要使用具有 **`workflow` scope** 的Personal Access Token才能推送。

## 📁 文件说明

### ci.yml - 持续集成
**触发条件**: Pull Request到main分支

**执行内容**:
- ✅ 运行单元测试和集成测试
- ✅ 代码质量检查（ESLint, TypeScript）
- ✅ 安全扫描（Trivy, npm audit）
- ✅ Docker镜像构建测试
- ✅ 上传测试覆盖率到Codecov

### deploy.yml - 自动部署
**触发条件**: Push到main分支

**执行内容**:
- ✅ 构建Docker镜像
- ✅ 推送到Amazon ECR
- ✅ 更新ECS任务定义
- ✅ 滚动更新部署
- ✅ 运行数据库迁移
- ✅ 发送部署通知

---

## 🔧 安装方法

### 方法1: 手动创建（推荐）

1. **在GitHub网站上创建文件**
   ```
   在GitHub仓库页面:
   1. 点击 "Add file" → "Create new file"
   2. 文件路径: .github/workflows/ci.yml
   3. 复制粘贴 ci.yml 的内容
   4. Commit直接到main分支

   重复以上步骤创建 deploy.yml
   ```

2. **配置Secrets**
   ```
   在GitHub仓库页面:
   Settings → Secrets and variables → Actions → New repository secret

   添加以下secrets:
   - AWS_ACCESS_KEY_ID: 您的AWS访问密钥
   - AWS_SECRET_ACCESS_KEY: 您的AWS秘密密钥
   - DATABASE_URL: 数据库连接字符串
   - CLOUDFRONT_DISTRIBUTION_ID: CloudFront分发ID（如果使用）
   ```

### 方法2: 使用有workflow权限的Token

如果您有workflow权限的token:

```bash
# 1. 创建.github/workflows目录
mkdir -p .github/workflows

# 2. 复制workflow文件
cp aws-deployment/github-actions/*.yml .github/workflows/

# 3. 配置git使用新token
git remote set-url origin https://YOUR_USERNAME:YOUR_NEW_TOKEN@github.com/gabe32-h/fortune-teller-backend.git

# 4. 提交并推送
git add .github/
git commit -m "Add GitHub Actions workflows"
git push origin main
```

**创建有workflow权限的Token**:
1. 访问: https://github.com/settings/tokens/new
2. 勾选 `repo` 和 `workflow` 权限
3. 生成并保存token

### 方法3: 通过Pull Request

```bash
# 1. 创建新分支
git checkout -b add-workflows

# 2. 添加workflow文件
mkdir -p .github/workflows
cp aws-deployment/github-actions/*.yml .github/workflows/

# 3. 提交
git add .github/
git commit -m "Add GitHub Actions workflows"

# 4. 推送到新分支
git push origin add-workflows

# 5. 在GitHub上创建Pull Request
# 6. 合并PR（合并时会自动允许workflow文件）
```

---

## 🔐 需要配置的Secrets

在GitHub仓库的 **Settings → Secrets and variables → Actions** 中添加：

### AWS部署相关
```
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
```

### 数据库
```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

### 可选配置
```
CLOUDFRONT_DISTRIBUTION_ID=E123456789ABCD  # 如果使用CloudFront
SLACK_WEBHOOK=https://hooks.slack.com/...   # Slack通知
```

---

## 📋 工作流详细说明

### CI工作流 (ci.yml)

```yaml
触发时机:
  - Pull Request到main分支
  - Push到develop分支

运行步骤:
  1. Checkout代码
  2. Setup Node.js 20
  3. 安装依赖
  4. 代码检查 (Lint + TypeScript)
  5. 运行测试
     - 启动PostgreSQL和Redis服务
     - 运行Prisma迁移
     - 执行测试套件
     - 生成覆盖率报告
  6. 构建Docker镜像（不推送）
  7. 安全扫描
     - Trivy漏洞扫描
     - npm audit审计

运行时间: 约5-8分钟
```

### Deploy工作流 (deploy.yml)

```yaml
触发时机:
  - Push到main分支
  - 手动触发 (workflow_dispatch)

运行步骤:
  1. Checkout代码
  2. 配置AWS凭证
  3. 登录Amazon ECR
  4. 构建Docker镜像
  5. 打标签 (git sha)
  6. 推送到ECR
  7. 更新ECS任务定义
  8. 部署到ECS
     - 使用滚动更新策略
     - 等待服务稳定
  9. 运行数据库迁移
  10. 发送通知 (可选)

运行时间: 约8-12分钟
```

---

## 🎯 使用建议

### 开发流程

```mermaid
graph LR
    A[开发功能] --> B[创建PR]
    B --> C[CI自动测试]
    C --> D{测试通过?}
    D -->|是| E[Code Review]
    D -->|否| F[修复问题]
    F --> B
    E --> G[合并到main]
    G --> H[Deploy自动部署]
    H --> I[生产环境]
```

### 最佳实践

1. **分支保护**
   - 设置main分支保护规则
   - 要求CI检查通过才能合并
   - 要求至少1个审批

2. **测试覆盖率**
   - 保持测试覆盖率 > 80%
   - 关键功能必须有测试

3. **部署策略**
   - 使用滚动更新
   - 启用deployment circuit breaker
   - 监控部署后的指标

4. **回滚策略**
   - 保留至少3个版本的Docker镜像
   - 部署失败自动回滚
   - 准备好手动回滚命令

---

## 🔧 自定义配置

### 修改CI检查

编辑 `ci.yml`:

```yaml
# 修改测试数据库
services:
  postgres:
    env:
      POSTGRES_DB: your_test_db

# 添加更多检查
- name: Custom check
  run: npm run custom-script
```

### 修改部署策略

编辑 `deploy.yml`:

```yaml
# 修改ECS配置
env:
  ECS_CLUSTER: your-cluster-name
  ECS_SERVICE: your-service-name

# 添加部署前检查
- name: Pre-deployment check
  run: ./scripts/pre-deploy.sh
```

### 添加环境

创建 `deploy-staging.yml` 用于staging环境：

```yaml
name: Deploy to Staging

on:
  push:
    branches:
      - develop

env:
  ECS_CLUSTER: fortune-teller-cluster-staging
  ECS_SERVICE: fortune-teller-backend-service-staging
```

---

## 📊 监控和调试

### 查看工作流运行

```
GitHub仓库 → Actions 标签
- 查看所有运行历史
- 点击具体运行查看日志
- 下载artifacts（如测试报告）
```

### 调试失败的工作流

```bash
# 1. 查看错误日志
# 在GitHub Actions页面点击失败的步骤查看详细日志

# 2. 本地复现
# 使用act工具本地运行GitHub Actions
brew install act
act -j test  # 运行test job

# 3. 检查Secrets配置
# 确保所有required secrets都已配置
```

### 常见问题

**问题1: AWS认证失败**
```
解决: 检查AWS_ACCESS_KEY_ID和AWS_SECRET_ACCESS_KEY是否正确
```

**问题2: Docker推送失败**
```
解决: 检查ECR仓库权限，确保IAM用户有ECR推送权限
```

**问题3: ECS部署超时**
```
解决:
- 检查ECS任务定义是否正确
- 检查健康检查配置
- 增加wait超时时间
```

---

## 📚 相关文档

- [GitHub Actions文档](https://docs.github.com/en/actions)
- [AWS ECS部署](https://github.com/aws-actions/amazon-ecs-deploy-task-definition)
- [Docker构建推送](https://github.com/docker/build-push-action)
- [工作流语法](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)

---

## 🎉 快速开始

**推荐使用方法1（手动创建）**，最简单且无需额外权限：

1. 在GitHub网站上创建 `.github/workflows/ci.yml`
2. 复制粘贴本目录的 `ci.yml` 内容
3. Commit到main分支
4. 重复步骤创建 `deploy.yml`
5. 配置Secrets
6. 完成！

下次创建PR或推送代码时，工作流会自动运行！🚀
